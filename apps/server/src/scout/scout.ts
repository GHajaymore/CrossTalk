// The Topic Scout (docs/PLAN.md): a scheduled job with a fixed number of requests, not a free-running agent.
// Gather → filter → rank and brief (one request) → Today tray, or Autopilot's one episode a day.
import { randomUUID } from 'node:crypto';
import { AUTOPILOT_REQUESTS, blockedHit, DEFAULT_RULES, DEFAULT_SCOUT_PREFS, ScoutPrefs, scoutPicks, type Rules, type ScoutStatus, type ScoutTopic } from '@crosstalk/shared';
import type { Repo } from '../db/repo';
import { isNoGo } from './filter';
import { buildRankPrompt, MAX_CANDIDATES, parseRanking } from './rank';
import type { Candidate, TopicSource } from './sources';

const PREFS_KEY = 'scout.prefs';
const SOURCE_TIMEOUT_MS = 20_000;

export type ScoutOptions = {
  sources: TopicSource[];
  /** The one rank-and-brief request. Mock mode answers from saved samples. */
  rank: (prompt: { system: string; user: string }) => Promise<string>;
  /** Real mode only: settings complete and the model passes the free-model guard. Returns why not, or null. */
  preflight?: () => Promise<string | null>;
  /** Whether the rank request counts toward the daily limit (real mode). */
  counts: boolean;
  requestsLeft: () => number;
  countRequest: () => void;
  /** Starts the top pick as an episode; returns its id. */
  autopilot: (topic: ScoutTopic) => Promise<string>;
  onChange?: () => void;
  now?: () => Date;
  today: () => string;
  /** SCOUT_TIME, "HH:MM" server time. */
  time: string;
  /** The Control room's rules: blocked words drop stories; politics and scandals only when allowed. */
  rules?: () => Rules;
};

export class ScoutError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export class Scout {
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private now: () => Date;

  constructor(private repo: Repo, private opts: ScoutOptions) {
    this.now = opts.now ?? (() => new Date());
    repo.failRunningScoutRuns();
  }

  prefs(): ScoutPrefs {
    const saved = ScoutPrefs.safeParse(this.repo.getSetting(PREFS_KEY));
    return saved.success ? saved.data : DEFAULT_SCOUT_PREFS;
  }
  setPrefs(p: ScoutPrefs) { this.repo.setSetting(PREFS_KEY, p); this.opts.onChange?.(); }

  status(): ScoutStatus {
    const last = this.repo.latestScoutRun();
    return { time: this.opts.time, running: !!this.running, lastRun: last && { ...last } };
  }

  /** The latest successful run's topics (they stay until the next one works). */
  tray(): ScoutTopic[] {
    const ok = this.repo.latestOkScoutRun();
    return ok ? this.repo.topicsForRun(ok.id) : [];
  }

  /** Resolves when the current run has finished (for tests). */
  settled() { return this.running ?? Promise.resolve(); }

  /** One Scout run. Refused while another is going. */
  run(scheduled = false): Promise<void> {
    if (this.running) throw new ScoutError('The Scout is already looking. Give it a moment.', 409);
    const p = this.doRun(scheduled).finally(() => { this.running = null; this.opts.onChange?.(); });
    this.running = p;
    this.opts.onChange?.();
    return p;
  }

  private async doRun(scheduled: boolean) {
    const id = randomUUID(), date = this.opts.today(), at = this.now().toISOString();
    this.repo.insertScoutRun(id, date, at, scheduled);
    const ok: string[] = [], failed: string[] = [];
    const finish = (state: 'ok' | 'failed', error: string | null) => this.repo.finishScoutRun(id, { state, error, sourcesOk: ok, sourcesFailed: failed });
    try {
      // 1. Gather: every source on its own; one failing never stops the others.
      const results = await Promise.allSettled(this.opts.sources.map(s => s.gather(AbortSignal.timeout(SOURCE_TIMEOUT_MS))));
      const candidates: Candidate[] = [];
      results.forEach((r, i) => {
        const name = this.opts.sources[i].name;
        if (r.status === 'fulfilled') { ok.push(name); candidates.push(...r.value); } else failed.push(name);
      });
      if (!ok.length) return finish('failed', 'No source could be read. The Scout will try again tomorrow, or press Run Scout now.');

      // 2. Filter: no tragedies, crime, health scares or private lives; one candidate per link.
      const seen = new Set<string>();
      const rules = this.opts.rules?.() ?? DEFAULT_RULES;
      const kept = candidates.filter(c => !isNoGo(`${c.title} ${c.excerpt}`) && !blockedHit(`${c.title} ${c.excerpt}`, rules.blocked) && !seen.has(c.url) && !!seen.add(c.url))
        .sort((a, b) => score(b) - score(a)).slice(0, MAX_CANDIDATES);
      if (!kept.length) return finish('failed', 'Nothing usable today: every story was filtered out.');

      // 3. Rank and brief: one request.
      if (this.opts.preflight) {
        const blocked = await this.opts.preflight();
        if (blocked) return finish('failed', blocked);
      }
      if (this.opts.counts) {
        if (this.opts.requestsLeft() < 1) return finish('failed', 'Daily request limit reached. The Scout will try again tomorrow.');
        this.opts.countRequest();
      }
      const reply = await this.opts.rank(buildRankPrompt(kept, this.prefs().place));
      const topics = parseRanking(reply, kept, { runId: id, date, at });
      if (!topics.length) return finish('failed', 'The ranking came back without any usable, sourced topics.');
      this.repo.insertTopics(topics);
      finish('ok', null);

      // 4. Autopilot: at most one episode a day, only when switched on, only with enough requests left.
      const prefs = this.prefs();
      if (prefs.autopilot && !this.repo.autopilotRanOn(date)) {
        const pick = scoutPicks(topics, prefs, 'general', this.opts.rules?.() ?? DEFAULT_RULES)[0];
        if (!pick) this.repo.setAutopilot(id, null, 'No topic matched your Scout preferences today.');
        else if (this.opts.requestsLeft() < AUTOPILOT_REQUESTS) this.repo.setAutopilot(id, null, `Skipped: an episode needs about ${AUTOPILOT_REQUESTS} requests and fewer are left today.`);
        else {
          try { this.repo.setAutopilot(id, await this.opts.autopilot(pick), null); } catch (e) { this.repo.setAutopilot(id, null, `Couldn't start: ${(e as Error).message}`); }
        }
      }
    } catch (e) {
      finish('failed', (e as Error).message || 'The Scout run failed.');
    }
  }

  /** Runs once a day after SCOUT_TIME, and catches up once if the app starts later than that. */
  tick() {
    if (this.running) return;
    const [h, m] = this.opts.time.split(':').map(Number);
    const now = this.now();
    const due = new Date(now); due.setHours(h, m, 0, 0);
    if (now < due) return;
    if (this.repo.scoutRunsOn(this.opts.today()).some(r => r.scheduled)) return;
    void this.run(true).catch(() => {});
  }

  start() { this.tick(); this.timer = setInterval(() => this.tick(), 60_000); this.timer.unref?.(); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

/** Busier stories first, so the 20 the model sees are the ones people are talking about. */
const score = (c: Candidate) => (c.comments ?? 0) * 2 + (c.points ?? 0) + (c.views ?? 0) / 1000;
