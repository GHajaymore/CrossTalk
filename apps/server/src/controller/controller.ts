import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  assertTransition, jobFor, resolveSpeakers, speakerFor, TransitionError,
  type Conversation, type ConversationView, type CreateConversation, type LiveTurn, type Run, type RunState, type StreamEvent,
} from '@crosstalk/shared';
import type { Repo } from '../db/repo';
import { AbortedError, type Provider } from '../providers/types';

export class ControllerError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type ControllerOptions = {
  maxTurns: number;
  dailyLimit: number;
  models: { A: string; B: string };
  now?: () => Date;
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

  // ---- queries ----
  get activeConversationId() { return this.active?.conversationId ?? null; }
  /** The turn being written for this conversation, so a late subscriber can catch up mid-turn. */
  liveTurn(conversationId: string): LiveTurn | null {
    return this.active?.conversationId === conversationId ? this.active.live : null;
  }
  today() { return this.now().toLocaleDateString('en-CA'); }
  requestsToday() { return this.repo.requestsOn(this.today()); }

  /** Resolves when the conversation's current run has stopped generating. */
  settled(conversationId: string) {
    return this.active?.conversationId === conversationId ? this.active.done : Promise.resolve();
  }

  // ---- commands ----
  create(input: CreateConversation): ConversationView {
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
      speakers: resolveSpeakers(input.topic, input.audience, input.speakers, this.opts.models),
      parentId: null,
      branchTurnId: null,
      createdAt: at,
      updatedAt: at,
    };
    this.repo.insertConversation(c);
    return this.repo.view(c.id)!;
  }

  /** On server start: a run that was generating when the server stopped becomes paused ("interrupted"), never rerun. */
  recoverInterrupted(): number {
    const runs = this.repo.runsInState('generating');
    for (const r of runs) this.transition(r, 'paused', 'interrupted');
    return runs.length;
  }

  start(conversationId: string): Run {
    const conv = this.repo.getConversation(conversationId);
    if (!conv) throw new ControllerError('Conversation not found.', 404);
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

    let run = this.repo.latestRun(conversationId);
    try {
      if (!run) {
        assertTransition('idle', 'generating');
        run = {
          id: randomUUID(), conversationId, state: 'generating',
          fromSeq: this.repo.lastSeq(conversationId) + 1, toSeq: this.opts.maxTurns,
          startedAt: this.now().toISOString(), endedAt: null, stopReason: null, pauseRequested: false,
        };
        this.repo.insertRun(run);
      } else {
        run = this.transition(run, 'generating', null);
      }
    } catch (e) {
      if (e instanceof TransitionError) throw new ControllerError(`This run is ${e.from} and can't be restarted. Branching arrives in Milestone 4.`, 409);
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
    this.emit(conversationId, { type: 'changed' });
  }

  // ---- internals ----
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

      const seq = this.repo.lastSeq(conversationId) + 1;
      if (seq > this.opts.maxTurns) { this.transition(run, 'completed', null); return; }
      if (run.pauseRequested) { this.transition(run, 'paused', 'by you'); return; }
      if (this.requestsToday() >= this.opts.dailyLimit) { this.transition(run, 'paused', 'Daily request limit reached'); return; }

      const conv = this.repo.getConversation(conversationId)!;
      const speaker = conv.speakers[speakerFor(seq)];
      const objective = jobFor(seq);
      const live: LiveTurn = { seq, speakerId: speaker.id, objective, modelId: speaker.modelId, text: '' };
      if (this.active?.runId === runId) this.active.live = live;
      this.emit(conversationId, { type: 'turn-start', ...live });
      this.repo.countRequest(this.today());

      let text: string;
      try {
        ({ text } = await this.provider.generateTurn(
          { conversation: conv, seq, speaker, objective, history: this.repo.listTurns(conversationId) },
          { signal, onToken: t => { live.text += t; this.emit(conversationId, { type: 'token', seq, text: t }); } },
        ));
      } catch (e) {
        if (e instanceof AbortedError || signal.aborted) return;
        const latest = this.repo.latestRun(conversationId);
        if (latest?.state === 'generating') this.transition(latest, 'failed', e instanceof Error ? e.message : 'The provider failed.');
        return;
      }
      if (signal.aborted) return;

      const at = this.now().toISOString();
      this.repo.saveTurn({
        id: randomUUID(), conversationId, seq, speakerId: speaker.id, modelId: speaker.modelId,
        objective, text, status: 'completed', createdAt: at,
      });
      this.repo.touchConversation(conversationId, at);
      if (this.active?.runId === runId) this.active.live = null;
      this.emit(conversationId, { type: 'turn-end', seq });
      this.emit(conversationId, { type: 'changed' });
    }
  }
}
