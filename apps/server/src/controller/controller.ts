import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  assertTransition, BRANCH_TURNS, CUE_LIMIT, extractStance, STANCE_END_JOBS, STANCE_START_JOBS, jobIn, resolveSpeakers, speakerFor, stepTemperature, TransitionError,
  type BranchInput, type Conversation, type ConversationView, type CreateConversation, type CueInput, type Intervention,
  type LiveTurn, type Run, type RunState, type StreamEvent,
} from '@crosstalk/shared';
import type { Repo } from '../db/repo';
import { AbortedError, ProviderError, type Provider, type Usage } from '../providers/types';

/** A 429 may be waited out once, up to this long. Longer waits pause the run instead. */
export const MAX_RETRY_WAIT_MS = 20_000;
/** A busy model (429 without Retry-After, 5xx, "overloaded") waits this long before its one retry. */
export const BUSY_WAIT_MS = 10_000;
/** Timeouts and network errors wait this long. */
export const OTHER_WAIT_MS = 2_000;
/** Replies longer than this are trimmed to whole sentences (kids get a shorter limit). */
export const MAX_SPOKEN_WORDS = { kids: 60, other: 90 } as const;

const isBusy = (e: ProviderError) => e.status === 429 || (e.status !== null && e.status >= 500) || /overload|busy|capacity/i.test(e.message);
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Keeps whole sentences up to `max` words. Leaves the text alone if trimming would leave too little. */
export function fitToLength(text: string, max: number): string {
  if (wordCount(text) <= max) return text;
  const sentences = text.match(/[^.?!]+[.?!]+["'”’)\]]?(\s+|$)/g) ?? [];
  let out = '';
  for (const s of sentences) {
    if (wordCount(out + s) > max) break;
    out += s;
  }
  return wordCount(out) >= 12 ? out.trim() : text;
}
/** At most one automatic retry per turn: two attempts. */
export const MAX_ATTEMPTS = 2;

const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const t = setTimeout(() => { signal.removeEventListener('abort', on); resolve(); }, ms);
    const on = () => { clearTimeout(t); reject(new AbortedError()); };
    signal.addEventListener('abort', on, { once: true });
  });

export class ControllerError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type ControllerOptions = {
  maxTurns: number;
  dailyLimit: number;
  models: { A: string; B: string };
  now?: () => Date;
  /** Checked before every run (config problems, free-model guard). Returns why the run is blocked, or null. */
  preflight?: () => Promise<string | null>;
  /** Called once when a run completes (Iris listens then). */
  onCompleted?: (conversationId: string) => void;
  /** Waiting before a retry. Replaceable in tests. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

/** What a subscriber hears for one conversation: stream events, plus "changed" when it should re-read the snapshot. */
export type ControllerEvent = StreamEvent | { type: 'changed' };

type Active = { conversationId: string; runId: string; abort: AbortController; done: Promise<void>; live: LiveTurn | null };

/**
 * Owns the turn loop. For each seq it picks the speaker, calls the provider, streams tokens,
 * saves the finished turn, then checks for Pause and Stop before the next one.
 * One run generates at a time, app-wide.
 */
export class ConversationController {
  private active: Active | null = null;
  private starting: string | null = null;
  private readonly bus = new EventEmitter();
  private readonly now: () => Date;

  constructor(private repo: Repo, private provider: Provider, private opts: ControllerOptions) {
    this.now = opts.now ?? (() => new Date());
    this.bus.setMaxListeners(100);
  }

  // ---- events ----
  subscribe(conversationId: string, fn: (e: ControllerEvent) => void) {
    this.bus.on(conversationId, fn);
    return () => { this.bus.off(conversationId, fn); };
  }
  private emit(conversationId: string, e: ControllerEvent) { this.bus.emit(conversationId, e); }
  /** Something else about this conversation changed (e.g. Iris finished); subscribers re-read it. */
  notify(conversationId: string) { this.emit(conversationId, { type: 'changed' }); }

  // ---- queries ----
  get activeConversationId() { return this.active?.conversationId ?? null; }
  /** The turn being written for this conversation, so a late subscriber can catch up mid-turn. */
  liveTurn(conversationId: string): LiveTurn | null {
    return this.active?.conversationId === conversationId ? this.active.live : null;
  }
  today() { return this.now().toLocaleDateString('en-CA'); }
  requestsToday() { return this.repo.requestsOn(this.today()); }
  /** Counts a model request made outside a run (e.g. writing host roles) toward today's limit. */
  countRequest() { this.repo.countRequest(this.today()); }

  /** Resolves when the conversation's current run has stopped generating. */
  settled(conversationId: string) {
    return this.active?.conversationId === conversationId ? this.active.done : Promise.resolve();
  }

  // ---- commands ----
  create(input: CreateConversation, roles?: [string, string]): ConversationView {
    const at = this.now().toISOString();
    const c: Conversation = {
      id: randomUUID(),
      title: input.topic,
      topic: input.topic,
      mode: input.mode,
      format: input.format,
      audience: input.audience,
      temperature: input.audience === 'kids' && input.temperature === 'heated' ? 'lively' : input.temperature,
      episode: this.repo.nextEpisode(),
      speakers: resolveSpeakers(input.topic, input.audience, input.speakers, this.opts.models, roles),
      parentId: null,
      branchTurnId: null,
      branchSeq: null,
      branchDirection: null,
      scoutTopicId: input.scoutTopicId ?? null,
      createdAt: at,
      updatedAt: at,
    };
    this.repo.insertConversation(c);
    return this.repo.view(c.id)!;
  }

  /** Removes an episode for good. Not while it's generating, and not while branches still read its turns. */
  remove(conversationId: string) {
    if (!this.repo.getConversation(conversationId)) throw new ControllerError('Conversation not found.', 404);
    if (this.starting === conversationId || this.active?.conversationId === conversationId || this.repo.latestRun(conversationId)?.state === 'generating') {
      throw new ControllerError('Stop the episode before deleting it.', 409);
    }
    const n = this.repo.branchCount(conversationId);
    if (n) throw new ControllerError(`This episode has ${n} branch${n === 1 ? ' that reads' : 'es that read'} its turns. Delete ${n === 1 ? 'it' : 'them'} first.`, 409);
    this.repo.deleteConversation(conversationId);
  }

  /** The last turn a conversation generates: the episode length, or a branch point plus 4. */
  private limitFor(c: Conversation) {
    return c.branchSeq ? c.branchSeq + BRANCH_TURNS : this.opts.maxTurns;
  }

  /**
   * Queues a listener cue for the next turn boundary. While a turn is being written it lands on the
   * turn after that, so finished or half-written words never change. Up to CUE_LIMIT per conversation,
   * one waiting at a time.
   */
  addCue(conversationId: string, input: CueInput): Intervention {
    const conv = this.repo.getConversation(conversationId);
    if (!conv) throw new ControllerError('Conversation not found.', 404);
    const run = this.repo.latestRun(conversationId);
    if (run && (run.state === 'completed' || run.state === 'cancelled')) {
      throw new ControllerError('This episode has finished. Branch from a turn to take it somewhere new.', 409);
    }
    const last = this.repo.lastSeq(conversationId);
    if (last < 1) throw new ControllerError('Cues land between turns. Start the episode first.', 409);
    const writing = this.active?.conversationId === conversationId && !!this.active.live;
    const appliesBeforeSeq = last + (writing ? 2 : 1);
    if (appliesBeforeSeq > this.limitFor(conv)) throw new ControllerError("The episode is about to end, so there's no turn left for a cue.", 409);

    const cues = this.repo.listCues(conversationId).filter(x => x.status !== 'cancelled');
    if (cues.length >= CUE_LIMIT) throw new ControllerError(`You've used all ${CUE_LIMIT} cues for this episode.`, 409);
    const waiting = cues.find(x => x.status === 'queued');
    if (waiting) throw new ControllerError(`A cue is already waiting for turn ${waiting.appliesBeforeSeq}. Cancel it, or wait until it lands.`, 409);

    const cue: Intervention = {
      id: randomUUID(), kind: input.kind, text: null, targetSeq: null, fromTemp: null, toTemp: null,
      appliesBeforeSeq, status: 'queued', createdAt: this.now().toISOString(), fromOriginal: false,
    };
    if (input.kind === 'challenge' || input.kind === 'guest') cue.text = input.text;
    if (input.kind === 'deeper') {
      if (!this.repo.listTurns(conversationId).some(t => t.seq === input.targetSeq)) throw new ControllerError('Pick a finished turn to go deeper on.', 400);
      cue.targetSeq = input.targetSeq;
    }
    if (input.kind === 'temp') {
      const to = stepTemperature(conv.temperature, input.direction, conv.audience);
      if (!to) {
        throw new ControllerError(input.direction === 'down' ? "It's already at Calm."
          : conv.audience === 'kids' ? 'Kids episodes stop at Lively.' : "It's already at Heated.", 409);
      }
      cue.fromTemp = conv.temperature;
      cue.toTemp = to;
    }
    this.repo.insertCue(conversationId, cue);
    this.emit(conversationId, { type: 'changed' });
    return cue;
  }

  /** Takes back a waiting cue. It doesn't count toward the limit. Too late once its turn is being written. */
  cancelCue(conversationId: string, cueId: string) {
    const cue = this.repo.listCues(conversationId).find(x => x.id === cueId);
    if (!cue) throw new ControllerError('Cue not found.', 404);
    if (cue.status !== 'queued') throw new ControllerError('That cue has already landed.', 409);
    const live = this.liveTurn(conversationId);
    if (live && live.seq >= cue.appliesBeforeSeq) throw new ControllerError("Too late: that cue is already on air.", 409);
    this.repo.setCueStatus(cueId, 'cancelled');
    this.emit(conversationId, { type: 'changed' });
  }

  /**
   * A branch is a new conversation that reads this one's turns up to `fromSeq` and generates 4 new
   * turns in the listener's direction. The original is never changed.
   */
  branch(conversationId: string, input: BranchInput): ConversationView {
    const parent = this.repo.getConversation(conversationId);
    if (!parent) throw new ControllerError('Conversation not found.', 404);
    if (this.active?.conversationId === conversationId || this.repo.latestRun(conversationId)?.state === 'generating') {
      throw new ControllerError('Pause or stop the episode before branching.', 409);
    }
    const turn = this.repo.listTurns(conversationId).find(t => t.seq === input.fromSeq);
    if (!turn) throw new ControllerError('Pick a finished turn to branch from.', 400);
    const at = this.now().toISOString();
    const c: Conversation = {
      ...parent,
      id: randomUUID(),
      title: input.direction,
      // The mood at the cut, not wherever the original ended up.
      temperature: this.repo.temperatureAt(conversationId, input.fromSeq),
      parentId: parent.id,
      branchTurnId: turn.id,
      branchSeq: input.fromSeq,
      branchDirection: input.direction,
      createdAt: at,
      updatedAt: at,
    };
    this.repo.insertConversation(c);
    this.emit(conversationId, { type: 'changed' });
    return this.repo.view(c.id)!;
  }

  /** On server start: a run that was generating when the server stopped becomes paused ("interrupted"), never rerun. */
  recoverInterrupted(): number {
    const runs = this.repo.runsInState('generating');
    for (const r of runs) this.transition(r, 'paused', 'interrupted');
    return runs.length;
  }

  async start(conversationId: string): Promise<Run> {
    const conv = this.repo.getConversation(conversationId);
    if (!conv) throw new ControllerError('Conversation not found.', 404);
    this.assertCanStart(conversationId);
    this.starting = conversationId;
    try {
      const blocked = await this.opts.preflight?.();
      if (blocked) throw new ControllerError(blocked, 412);
    } finally {
      this.starting = null;
    }
    this.assertCanStart(conversationId);
    return this.begin(conversationId);
  }

  private assertCanStart(conversationId: string) {
    if (this.starting) throw new ControllerError('A discussion is starting. Try again in a moment.', 409);
    if (this.active) {
      throw new ControllerError(this.active.conversationId === conversationId
        ? 'This discussion is already generating.'
        : 'Another discussion is generating. Pause or stop it first.', 409);
    }
    const busyElsewhere = this.repo.runsInState('generating').find(r => r.conversationId !== conversationId);
    if (busyElsewhere) throw new ControllerError('Another discussion is generating. Pause or stop it first.', 409);
    if (this.requestsToday() >= this.opts.dailyLimit) {
      throw new ControllerError(`Daily request limit reached (${this.opts.dailyLimit}). It resets tomorrow.`, 429);
    }
    const run = this.repo.latestRun(conversationId);
    if (run && (run.state === 'completed' || run.state === 'cancelled')) {
      throw new ControllerError(`This run is ${run.state} and can't be restarted. Branch from a turn to continue it.`, 409);
    }
  }

  private begin(conversationId: string): Run {
    let run = this.repo.latestRun(conversationId);
    try {
      if (!run) {
        assertTransition('idle', 'generating');
        run = {
          id: randomUUID(), conversationId, state: 'generating',
          fromSeq: this.repo.lastSeq(conversationId) + 1, toSeq: this.limitFor(this.repo.getConversation(conversationId)!),
          startedAt: this.now().toISOString(), endedAt: null, stopReason: null, pauseRequested: false,
        };
        this.repo.insertRun(run);
      } else {
        run = this.transition(run, 'generating', null);
      }
    } catch (e) {
      if (e instanceof TransitionError) throw new ControllerError(`This run is ${e.from} and can't be restarted. Branch from a turn to continue it.`, 409);
      throw e;
    }

    const abort = new AbortController();
    let finish!: () => void;
    const done = new Promise<void>(r => { finish = r; });
    this.active = { conversationId, runId: run.id, abort, done, live: null };
    this.emit(conversationId, { type: 'changed' });
    void this.loop(conversationId, run.id, abort.signal).finally(() => {
      if (this.active?.runId === run!.id) this.active = null;
      this.emit(conversationId, { type: 'changed' });
      finish();
    });
    return run;
  }

  /** Pause takes effect at the next turn boundary: the turn being written finishes and is saved first. */
  pause(conversationId: string) {
    const run = this.repo.latestRun(conversationId);
    if (!run || run.state !== 'generating') throw new ControllerError('Only a generating run can be paused.', 409);
    this.repo.updateRun(run.id, { pauseRequested: true });
    this.emit(conversationId, { type: 'changed' });
  }

  /**
   * Stop ends the run for good. A turn still being written is dropped, never half-saved,
   * so the run ends at the last completed turn boundary and no further turns are written.
   */
  stop(conversationId: string) {
    const run = this.repo.latestRun(conversationId);
    if (!run || !['generating', 'paused', 'failed'].includes(run.state)) {
      throw new ControllerError('There is no run to stop.', 409);
    }
    this.transition(run, 'cancelled', 'by you');
    if (this.active?.conversationId === conversationId) this.active.abort.abort();
    // Cues still waiting will never land.
    for (const c of this.repo.listCues(conversationId)) if (c.status === 'queued') this.repo.setCueStatus(c.id, 'cancelled');
    this.emit(conversationId, { type: 'changed' });
  }

  // ---- internals ----
  /**
   * One turn, with at most one automatic retry for timeouts, 429 and 5xx. Every attempt counts
   * toward the daily limit and is logged. Returns null when the run stopped, paused or failed.
   */
  private async generateWithRetry(
    conversationId: string, runId: string, conv: Conversation, seq: number,
    speaker: Conversation['speakers']['A'], objective: string, cues: Intervention[], signal: AbortSignal,
  ): Promise<{ text: string; stance: number | null } | null> {
    const sleep = this.opts.sleep ?? abortableSleep;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const run = this.repo.latestRun(conversationId)!;
      if (this.requestsToday() >= this.opts.dailyLimit) { this.transition(run, 'paused', 'Daily request limit reached'); return null; }

      const live: LiveTurn = { seq, speakerId: speaker.id, objective, modelId: speaker.modelId, text: '' };
      if (this.active?.runId === runId) this.active.live = live;
      this.emit(conversationId, { type: 'turn-start', ...live });
      this.repo.countRequest(this.today());

      const t0 = Date.now();
      const log = (status: 'ok' | 'error', usage: Usage | null, error: string | null) => this.repo.insertUsage({
        id: randomUUID(), runId, conversationId, seq, attempt, provider: this.provider.name, modelId: speaker.modelId,
        status, error, latencyMs: Date.now() - t0, tokensIn: usage?.tokensIn ?? null, tokensOut: usage?.tokensOut ?? null,
        costUsd: usage?.costUsd ?? null, date: this.today(), createdAt: this.now().toISOString(),
      });

      try {
        const res = await this.provider.generateTurn(
          { conversation: conv, seq, speaker, objective, history: this.repo.listTurns(conversationId), cues, brief: conv.scoutTopicId ? this.repo.getTopic(conv.scoutTopicId) : null },
          { signal, onToken: t => { live.text += t; this.emit(conversationId, { type: 'token', seq, text: t }); } },
        );
        log('ok', res.usage, null);
        // The Mind-change meter's tag is data, not speech: it comes out before the line is saved or read aloud.
        const { text, stance } = extractStance(res.text);
        return { text: fitToLength(text, conv.audience === 'kids' ? MAX_SPOKEN_WORDS.kids : MAX_SPOKEN_WORDS.other), stance };
      } catch (e) {
        if (e instanceof AbortedError || signal.aborted) { log('error', null, 'stopped'); return null; }
        const err = e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : 'The provider failed.');
        log('error', null, err.message);
        const latest = this.repo.latestRun(conversationId);
        if (latest?.state !== 'generating') return null;

        if (err.retryAfterMs !== null && err.retryAfterMs > MAX_RETRY_WAIT_MS) {
          this.transition(latest, 'paused', `Rate limited, try again in ${Math.ceil(err.retryAfterMs / 1000)} s`);
          return null;
        }
        if (err.retryable && attempt < MAX_ATTEMPTS) {
          try { await sleep(err.retryAfterMs ?? (isBusy(err) ? BUSY_WAIT_MS : OTHER_WAIT_MS), signal); } catch { return null; }
          if (this.repo.latestRun(conversationId)?.state !== 'generating') return null;
          continue;
        }
        this.transition(latest, 'failed', err.retryable && isBusy(err)
          ? `${err.message} The model is busy right now; wait a minute, then press Retry.`
          : err.message);
        return null;
      }
    }
    return null;
  }

  private transition(run: Run, to: RunState, reason: string | null): Run {
    assertTransition(run.state, to);
    const patch = {
      state: to,
      stopReason: reason,
      endedAt: to === 'generating' ? null : this.now().toISOString(),
      pauseRequested: false,
    };
    this.repo.updateRun(run.id, patch);
    return { ...run, ...patch };
  }

  private async loop(conversationId: string, runId: string, signal: AbortSignal) {
    for (;;) {
      const run = this.repo.latestRun(conversationId);
      if (!run || run.id !== runId || run.state !== 'generating' || signal.aborted) return;

      const conv = this.repo.getConversation(conversationId)!;
      const seq = this.repo.lastSeq(conversationId) + 1;
      if (seq > this.limitFor(conv)) { this.transition(run, 'completed', null); queueMicrotask(() => this.opts.onCompleted?.(conversationId)); return; }
      if (run.pauseRequested) { this.transition(run, 'paused', 'by you'); return; }
      if (this.requestsToday() >= this.opts.dailyLimit) { this.transition(run, 'paused', 'Daily request limit reached'); return; }

      // Cues waiting for this boundary land now. A temperature cue sets the mood for this turn; it's
      // saved with the turn, so a turn that fails or is stopped leaves the mood as it was.
      const cues = this.repo.cuesFor(conversationId).filter(x => x.status !== 'cancelled');
      const landing = cues.filter(x => !x.fromOriginal && x.status === 'queued' && x.appliesBeforeSeq <= seq);
      const temp = landing.filter(x => x.kind === 'temp').at(-1)?.toTemp;
      if (temp) conv.temperature = temp;

      const speaker = conv.speakers[speakerFor(seq)];
      const objective = jobIn(conv, seq);
      const out = await this.generateWithRetry(conversationId, runId, conv, seq, speaker, objective, cues, signal);
      if (!out || signal.aborted) return;
      const { text, stance } = out;

      const at = this.now().toISOString();
      // The turn, the cues it answered and any new mood are saved together, or not at all.
      this.repo.db.transaction(() => {
        this.repo.saveTurn({
          id: randomUUID(), conversationId, seq, speakerId: speaker.id, modelId: speaker.modelId,
          objective, text, status: 'completed', createdAt: at,
          stance: (STANCE_START_JOBS as readonly string[]).includes(objective) || (STANCE_END_JOBS as readonly string[]).includes(objective) ? stance : null,
        });
        for (const c of landing) this.repo.setCueStatus(c.id, 'applied');
        if (temp) this.repo.setTemperature(conversationId, temp);
        this.repo.touchConversation(conversationId, at);
      })();
      if (this.active?.runId === runId) this.active.live = null;
      this.emit(conversationId, { type: 'turn-end', seq });
      this.emit(conversationId, { type: 'changed' });
    }
  }
}
