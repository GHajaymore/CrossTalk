import Database from 'better-sqlite3';
import { ArtistNotes, Conversation, Intervention, Run, type BranchSummary, type ConversationView, type ScoutStatus, type ScoutTopic, type IrisFeedback, type PaintStyle, type RunState, type Speakers, type Turn } from '@crosstalk/shared';
import { MIGRATIONS } from './schema';

export type DB = Database.Database;

export type UsageRow = {
  id: string; runId: string; conversationId: string; seq: number; attempt: number; provider: string; modelId: string;
  status: 'ok' | 'error'; error: string | null; latencyMs: number; tokensIn: number | null; tokensOut: number | null;
  costUsd: number | null; date: string; createdAt: string;
};

export function openDb(file: string): DB {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  // Wait rather than fail if the backup (Litestream) briefly holds the database.
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return db;
}

type ConvRow = {
  id: string; title: string; topic: string; mode: string; format: string; audience: string; temperature: string;
  episode: number; speakers_json: string; parent_id: string | null; branch_turn_id: string | null;
  branch_seq: number | null; branch_direction: string | null; scout_topic_id: string | null; publish: string | null; verdict: string | null; you_start: number | null; you_end: number | null; created_at: string; updated_at: string;
};
type TopicRow = {
  id: string; run_id: string; date: string; rank: number; question: string; category: string; region: string;
  split: number; buzz: number; bullets: string; sources: string; created_at: string; pinned: number; hidden: number;
};
type ScoutRunRow = {
  id: string; date: string; started_at: string; state: string; error: string | null; sources_ok: string; sources_failed: string;
  scheduled: number; autopilot_conversation_id: string | null; autopilot_note: string | null;
};
export type ScoutRun = NonNullable<ScoutStatus['lastRun']> & { scheduled: boolean };
const toTopic = (r: TopicRow): ScoutTopic => ({
  id: r.id, runId: r.run_id, date: r.date, question: r.question, category: r.category as ScoutTopic['category'],
  region: r.region as ScoutTopic['region'], split: r.split, buzz: r.buzz, bullets: JSON.parse(r.bullets), sources: JSON.parse(r.sources), createdAt: r.created_at,
  pinned: !!r.pinned, hidden: !!r.hidden,
});
const toScoutRun = (r: ScoutRunRow): ScoutRun => ({
  id: r.id, date: r.date, startedAt: r.started_at, state: r.state === 'ok' ? 'ok' : 'failed', error: r.error,
  sourcesOk: JSON.parse(r.sources_ok), sourcesFailed: JSON.parse(r.sources_failed), scheduled: !!r.scheduled,
  autopilotConversationId: r.autopilot_conversation_id, autopilotNote: r.autopilot_note,
});
type CueRow = {
  id: string; conversation_id: string; kind: string; text: string | null; target_seq: number | null; from_temp: string | null;
  to_temp: string | null; applies_before_seq: number; status: string; created_at: string;
};
type TurnRow = {
  id: string; conversation_id: string; seq: number; speaker_id: string; model_id: string; objective: string;
  text: string; status: string; created_at: string; stance: number | null;
};
type RunRow = {
  id: string; conversation_id: string; state: string; from_seq: number; to_seq: number; started_at: string;
  ended_at: string | null; stop_reason: string | null; pause_requested: number;
};

const toConversation = (r: ConvRow): Conversation => Conversation.parse({
  id: r.id, title: r.title, topic: r.topic, mode: r.mode, format: r.format, audience: r.audience,
  temperature: r.temperature, episode: r.episode, speakers: JSON.parse(r.speakers_json) as Speakers,
  parentId: r.parent_id, branchTurnId: r.branch_turn_id, branchSeq: r.branch_seq, branchDirection: r.branch_direction,
  scoutTopicId: r.scout_topic_id, publish: r.publish, verdict: r.verdict, youStart: r.you_start, youEnd: r.you_end, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toCue = (r: CueRow): Intervention => Intervention.parse({
  id: r.id, kind: r.kind, text: r.text, targetSeq: r.target_seq, fromTemp: r.from_temp, toTemp: r.to_temp,
  appliesBeforeSeq: r.applies_before_seq, status: r.status, createdAt: r.created_at,
});
const toTurn = (r: TurnRow): Turn => ({
  id: r.id, conversationId: r.conversation_id, seq: r.seq, speakerId: r.speaker_id as Turn['speakerId'],
  modelId: r.model_id, objective: r.objective, text: r.text, status: 'completed', createdAt: r.created_at, stance: r.stance ?? null,
});
const toRun = (r: RunRow): Run => Run.parse({
  id: r.id, conversationId: r.conversation_id, state: r.state, fromSeq: r.from_seq, toSeq: r.to_seq,
  startedAt: r.started_at, endedAt: r.ended_at, stopReason: r.stop_reason, pauseRequested: !!r.pause_requested,
});

/** The only place SQL lives. */
export class Repo {
  constructor(readonly db: DB) {}

  insertConversation(c: Conversation) {
    this.db.prepare(`INSERT INTO conversations
      (id, title, topic, mode, format, audience, temperature, episode, speakers_json, parent_id, branch_turn_id, branch_seq, branch_direction, scout_topic_id, you_start, you_end, created_at, updated_at)
      VALUES (@id, @title, @topic, @mode, @format, @audience, @temperature, @episode, @speakers, @parentId, @branchTurnId, @branchSeq, @branchDirection, @scoutTopicId, @youStart, @youEnd, @createdAt, @updatedAt)`)
      .run({ ...c, scoutTopicId: c.scoutTopicId ?? null, youStart: c.youStart ?? null, youEnd: c.youEnd ?? null, speakers: JSON.stringify(c.speakers) });
  }

  getConversation(id: string): Conversation | null {
    const r = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConvRow | undefined;
    return r ? toConversation(r) : null;
  }

  listConversations(): Conversation[] {
    return (this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as ConvRow[]).map(toConversation);
  }

  setYou(id: string, start: number | null, end: number | null) {
    this.db.prepare('UPDATE conversations SET you_start = ?, you_end = ? WHERE id = ?').run(start, end, id);
  }

  setVerdict(id: string, verdict: Conversation['verdict']) {
    this.db.prepare('UPDATE conversations SET verdict = ? WHERE id = ?').run(verdict, id);
  }

  setPublish(id: string, publish: Conversation['publish']) {
    this.db.prepare('UPDATE conversations SET publish = ? WHERE id = ?').run(publish, id);
  }

  setTopicFlags(id: string, flags: { pinned?: boolean; hidden?: boolean }) {
    if (flags.pinned !== undefined) this.db.prepare('UPDATE scout_topics SET pinned = ? WHERE id = ?').run(flags.pinned ? 1 : 0, id);
    if (flags.hidden !== undefined) this.db.prepare('UPDATE scout_topics SET hidden = ? WHERE id = ?').run(flags.hidden ? 1 : 0, id);
  }

  audit(at: string, action: string, detail: string) {
    this.db.prepare('INSERT INTO admin_audit (at, action, detail) VALUES (?, ?, ?)').run(at, action, detail);
  }
  listAudit(limit = 30): { at: string; action: string; detail: string }[] {
    return this.db.prepare('SELECT at, action, detail FROM admin_audit ORDER BY id DESC LIMIT ?').all(limit) as { at: string; action: string; detail: string }[];
  }

  rename(id: string, title: string) {
    this.db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
  }

  /** Deletes a conversation and everything that belongs to it (turns, runs, usage, cues, Iris's notes cascade). */
  deleteConversation(id: string) {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  branchCount(id: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE parent_id = ?').get(id) as { n: number }).n;
  }

  setTemperature(id: string, temperature: Conversation['temperature']) {
    this.db.prepare('UPDATE conversations SET temperature = ? WHERE id = ?').run(temperature, id);
  }

  touchConversation(id: string, at: string) {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(at, id);
  }

  nextEpisode(): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE parent_id IS NULL').get() as { n: number };
    return r.n + 1;
  }

  /** Saves a completed turn. Saving the same (conversation, seq) twice keeps the first; returns false the second time. */
  saveTurn(t: Turn): boolean {
    const res = this.db.prepare(`INSERT INTO turns (id, conversation_id, seq, speaker_id, model_id, objective, text, status, created_at, stance)
      VALUES (@id, @conversationId, @seq, @speakerId, @modelId, @objective, @text, @status, @createdAt, @stance)
      ON CONFLICT (conversation_id, seq) DO NOTHING`).run({ ...t, stance: t.stance ?? null });
    return res.changes === 1;
  }

  /**
   * Every turn this conversation plays, in order. A branch reads its parent's turns up to the branch
   * point (they keep their parent's conversationId), then its own. Nothing is copied.
   */
  listTurns(conversationId: string): Turn[] {
    const c = this.getConversation(conversationId);
    const inherited = c?.parentId && c.branchSeq ? this.listTurns(c.parentId).filter(t => t.seq <= c.branchSeq!) : [];
    const own = (this.db.prepare(`SELECT * FROM turns WHERE conversation_id = ? AND status = 'completed' ORDER BY seq`)
      .all(conversationId) as TurnRow[]).map(toTurn);
    return [...inherited, ...own];
  }

  lastSeq(conversationId: string): number {
    const r = this.db.prepare(`SELECT MAX(seq) AS s FROM turns WHERE conversation_id = ? AND status = 'completed'`).get(conversationId) as { s: number | null };
    return r.s ?? this.getConversation(conversationId)?.branchSeq ?? 0;
  }

  // ---- cues ----
  insertCue(conversationId: string, c: Intervention) {
    this.db.prepare(`INSERT INTO interventions (id, conversation_id, kind, text, target_seq, from_temp, to_temp, applies_before_seq, status, created_at)
      VALUES (@id, @conversationId, @kind, @text, @targetSeq, @fromTemp, @toTemp, @appliesBeforeSeq, @status, @createdAt)`).run({ ...c, conversationId });
  }

  /** All cues, oldest first. */
  listCues(conversationId: string): Intervention[] {
    return (this.db.prepare('SELECT * FROM interventions WHERE conversation_id = ? ORDER BY created_at, rowid')
      .all(conversationId) as CueRow[]).map(toCue);
  }

  /**
   * The cues a conversation plays with: in a branch, the original's applied cues up to the cut
   * (marked fromOriginal), then its own. Limits and queueing only ever look at its own (listCues).
   */
  cuesFor(conversationId: string): Intervention[] {
    const c = this.getConversation(conversationId);
    const inherited = c?.parentId && c.branchSeq
      ? this.cuesFor(c.parentId).filter(x => x.status === 'applied' && x.appliesBeforeSeq <= c.branchSeq!).map(x => ({ ...x, fromOriginal: true }))
      : [];
    return [...inherited, ...this.listCues(conversationId)];
  }

  /** The Temperature in effect for turn `seq`, following any temperature cues that landed (in the original too, for a branch). */
  temperatureAt(conversationId: string, seq: number): Conversation['temperature'] {
    const c = this.getConversation(conversationId)!;
    if (c.parentId && c.branchSeq && seq <= c.branchSeq) return this.temperatureAt(c.parentId, seq);
    const temps = this.listCues(conversationId).filter(x => x.kind === 'temp' && x.status === 'applied').sort((a, b) => a.appliesBeforeSeq - b.appliesBeforeSeq);
    const landed = temps.filter(x => x.appliesBeforeSeq <= seq).at(-1);
    return landed?.toTemp ?? temps[0]?.fromTemp ?? c.temperature;
  }

  setCueStatus(id: string, status: Intervention['status']) {
    this.db.prepare('UPDATE interventions SET status = ? WHERE id = ?').run(status, id);
  }

  /** Branches cut from a conversation, newest first. */
  listBranches(parentId: string): BranchSummary[] {
    return (this.db.prepare('SELECT * FROM conversations WHERE parent_id = ? ORDER BY created_at DESC').all(parentId) as ConvRow[])
      .map(toConversation)
      .map(c => ({ id: c.id, title: c.title, branchSeq: c.branchSeq ?? 0, direction: c.branchDirection ?? '', state: this.latestRun(c.id)?.state ?? 'idle', createdAt: c.createdAt }));
  }

  insertRun(r: Run) {
    this.db.prepare(`INSERT INTO generation_runs (id, conversation_id, state, from_seq, to_seq, started_at, ended_at, stop_reason, pause_requested)
      VALUES (@id, @conversationId, @state, @fromSeq, @toSeq, @startedAt, @endedAt, @stopReason, @pause)`)
      .run({ ...r, pause: r.pauseRequested ? 1 : 0 });
  }

  updateRun(id: string, patch: Partial<Pick<Run, 'state' | 'endedAt' | 'stopReason' | 'pauseRequested'>>) {
    const cols: string[] = [];
    const vals: Record<string, unknown> = { id };
    if (patch.state !== undefined) { cols.push('state = @state'); vals.state = patch.state; }
    if (patch.endedAt !== undefined) { cols.push('ended_at = @endedAt'); vals.endedAt = patch.endedAt; }
    if (patch.stopReason !== undefined) { cols.push('stop_reason = @stopReason'); vals.stopReason = patch.stopReason; }
    if (patch.pauseRequested !== undefined) { cols.push('pause_requested = @pause'); vals.pause = patch.pauseRequested ? 1 : 0; }
    if (cols.length) this.db.prepare(`UPDATE generation_runs SET ${cols.join(', ')} WHERE id = @id`).run(vals);
  }

  latestRun(conversationId: string): Run | null {
    const r = this.db.prepare('SELECT * FROM generation_runs WHERE conversation_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1')
      .get(conversationId) as RunRow | undefined;
    return r ? toRun(r) : null;
  }

  runsInState(state: RunState): Run[] {
    return (this.db.prepare('SELECT * FROM generation_runs WHERE state = ?').all(state) as RunRow[]).map(toRun);
  }

  view(id: string): ConversationView | null {
    const c = this.getConversation(id);
    if (!c) return null;
    const parent = c.parentId ? this.getConversation(c.parentId) : null;
    return {
      ...c, turns: this.listTurns(id), run: this.latestRun(id),
      interventions: this.cuesFor(id).filter(x => x.status !== 'cancelled'),
      parent: parent && { id: parent.id, title: parent.title, episode: parent.episode },
      branches: this.listBranches(id),
      brief: c.scoutTopicId ? this.getTopic(c.scoutTopicId) : null,
      artist: this.getArtist(id),
    };
  }

  getArtist(conversationId: string): ArtistNotes | null {
    const r = this.db.prepare('SELECT * FROM artist_notes WHERE conversation_id = ?').get(conversationId) as Record<string, unknown> | undefined;
    if (!r) return null;
    return ArtistNotes.parse({
      conversationId: r.conversation_id, state: r.state, modelId: r.model_id, perspective: r.perspective, momentSeq: r.moment_seq,
      caption: r.caption, artTitle: r.art_title, artStyle: r.art_style, sketchSvg: r.sketch_svg ?? null, imagePrompt: r.image_prompt,
      error: r.error ?? null, version: r.version, createdAt: r.created_at,
    });
  }

  saveArtist(a: ArtistNotes) {
    this.db.prepare(`INSERT INTO artist_notes (conversation_id, state, model_id, perspective, moment_seq, caption, art_title, art_style, sketch_svg, image_prompt, error, version, created_at)
      VALUES (@conversationId, @state, @modelId, @perspective, @momentSeq, @caption, @artTitle, @artStyle, @sketchSvg, @imagePrompt, @error, @version, @createdAt)
      ON CONFLICT (conversation_id) DO UPDATE SET state = excluded.state, model_id = excluded.model_id, perspective = excluded.perspective,
        moment_seq = excluded.moment_seq, caption = excluded.caption, art_title = excluded.art_title, art_style = excluded.art_style,
        sketch_svg = excluded.sketch_svg, image_prompt = excluded.image_prompt, error = excluded.error, version = excluded.version,
        created_at = excluded.created_at, style_by_listener = 0`).run(a);
  }

  /** The listener picked a style for Iris's art. Returns false if she has nothing drawn to restyle. */
  setArtStyle(conversationId: string, style: PaintStyle) {
    return this.db.prepare(`UPDATE artist_notes SET art_style = ?, style_by_listener = 1
      WHERE conversation_id = ? AND state = 'done' AND sketch_svg IS NOT NULL`).run(style, conversationId).changes > 0;
  }

  /** Styles the listener chose themselves on recent drawings, newest first. */
  listenerStyles(limit = 10): PaintStyle[] {
    return (this.db.prepare(`SELECT art_style FROM artist_notes WHERE style_by_listener = 1 ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as { art_style: PaintStyle }[]).map(r => r.art_style);
  }

  addFeedback(f: IrisFeedback) {
    this.db.prepare(`INSERT INTO iris_feedback (id, conversation_id, rating, note, art_title, created_at)
      VALUES (@id, @conversationId, @rating, @note, @artTitle, @createdAt)`).run(f);
  }

  /** Most recent first. */
  listFeedback(limit = 20): IrisFeedback[] {
    return (this.db.prepare(`SELECT id, conversation_id AS conversationId, rating, note, art_title AS artTitle, created_at AS createdAt
      FROM iris_feedback ORDER BY created_at DESC, rowid DESC LIMIT ?`).all(limit) as IrisFeedback[]);
  }

  deleteFeedback(id: string) {
    this.db.prepare('DELETE FROM iris_feedback WHERE id = ?').run(id);
  }

  requestsOn(date: string): number {
    const r = this.db.prepare('SELECT requests FROM daily_counter WHERE date = ?').get(date) as { requests: number } | undefined;
    return r?.requests ?? 0;
  }

  insertUsage(u: UsageRow) {
    this.db.prepare(`INSERT INTO provider_usage (id, run_id, conversation_id, seq, attempt, provider, model_id, status, error, latency_ms, tokens_in, tokens_out, cost_usd, date, created_at)
      VALUES (@id, @runId, @conversationId, @seq, @attempt, @provider, @modelId, @status, @error, @latencyMs, @tokensIn, @tokensOut, @costUsd, @date, @createdAt)`).run(u);
  }

  listUsage(conversationId: string): UsageRow[] {
    return this.db.prepare(`SELECT id, run_id AS runId, conversation_id AS conversationId, seq, attempt, provider, model_id AS modelId, status, error,
      latency_ms AS latencyMs, tokens_in AS tokensIn, tokens_out AS tokensOut, cost_usd AS costUsd, date, created_at AS createdAt
      FROM provider_usage WHERE conversation_id = ? ORDER BY created_at, attempt`).all(conversationId) as UsageRow[];
  }

  /** Totals for a day. Cost is null when any attempt's cost is unknown. */
  usageOn(date: string): { attempts: number; tokensIn: number; tokensOut: number; costUsd: number | null } {
    const r = this.db.prepare(`SELECT COUNT(*) AS attempts, COALESCE(SUM(tokens_in), 0) AS tokensIn, COALESCE(SUM(tokens_out), 0) AS tokensOut,
      SUM(cost_usd) AS cost, SUM(CASE WHEN cost_usd IS NULL AND status = 'ok' THEN 1 ELSE 0 END) AS unknown,
      SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok FROM provider_usage WHERE date = ?`).get(date) as
      { attempts: number; tokensIn: number; tokensOut: number; cost: number | null; unknown: number; ok: number | null };
    // A failed attempt returns no reply and no price, so only successful attempts can make the total unknown.
    return { attempts: r.attempts, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.unknown > 0 ? null : r.cost ?? 0 };
  }

  // ---- Topic Scout ----
  getSetting<T>(key: string): T | null {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return r ? JSON.parse(r.value) as T : null;
  }
  setSetting(key: string, value: unknown) {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }

  insertScoutRun(id: string, date: string, startedAt: string, scheduled: boolean) {
    this.db.prepare(`INSERT INTO scout_runs (id, date, started_at, state, scheduled) VALUES (?, ?, ?, 'running', ?)`).run(id, date, startedAt, scheduled ? 1 : 0);
  }
  finishScoutRun(id: string, p: { state: 'ok' | 'failed'; error: string | null; sourcesOk: string[]; sourcesFailed: string[] }) {
    this.db.prepare('UPDATE scout_runs SET state = ?, error = ?, sources_ok = ?, sources_failed = ? WHERE id = ?')
      .run(p.state, p.error, JSON.stringify(p.sourcesOk), JSON.stringify(p.sourcesFailed), id);
  }
  setAutopilot(runId: string, conversationId: string | null, note: string | null) {
    this.db.prepare('UPDATE scout_runs SET autopilot_conversation_id = ?, autopilot_note = ? WHERE id = ?').run(conversationId, note, runId);
  }
  /** A run that was going when the server stopped never finished. */
  failRunningScoutRuns() {
    this.db.prepare(`UPDATE scout_runs SET state = 'failed', error = 'The server restarted during this run.' WHERE state = 'running'`).run();
  }
  latestScoutRun(): ScoutRun | null {
    const r = this.db.prepare(`SELECT * FROM scout_runs WHERE state != 'running' ORDER BY started_at DESC, rowid DESC LIMIT 1`).get() as ScoutRunRow | undefined;
    return r ? toScoutRun(r) : null;
  }
  latestOkScoutRun(): ScoutRun | null {
    const r = this.db.prepare(`SELECT * FROM scout_runs WHERE state = 'ok' ORDER BY started_at DESC, rowid DESC LIMIT 1`).get() as ScoutRunRow | undefined;
    return r ? toScoutRun(r) : null;
  }
  scoutRunsOn(date: string): ScoutRun[] {
    return (this.db.prepare('SELECT * FROM scout_runs WHERE date = ? ORDER BY started_at').all(date) as ScoutRunRow[]).map(toScoutRun);
  }
  autopilotRanOn(date: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM scout_runs WHERE date = ? AND autopilot_conversation_id IS NOT NULL').get(date);
  }

  insertTopics(topics: ScoutTopic[]) {
    const q = this.db.prepare(`INSERT INTO scout_topics (id, run_id, date, rank, question, category, region, split, buzz, bullets, sources, created_at)
      VALUES (@id, @runId, @date, @rank, @question, @category, @region, @split, @buzz, @bullets, @sources, @createdAt)`);
    this.db.transaction(() => topics.forEach((t, i) => q.run({ id: t.id, runId: t.runId, date: t.date, question: t.question, category: t.category, region: t.region,
      split: t.split, buzz: t.buzz, createdAt: t.createdAt, rank: i, bullets: JSON.stringify(t.bullets), sources: JSON.stringify(t.sources) })))();
  }
  topicsForRun(runId: string): ScoutTopic[] {
    return (this.db.prepare('SELECT * FROM scout_topics WHERE run_id = ? ORDER BY rank').all(runId) as TopicRow[]).map(toTopic);
  }
  getTopic(id: string): ScoutTopic | null {
    const r = this.db.prepare('SELECT * FROM scout_topics WHERE id = ?').get(id) as TopicRow | undefined;
    return r ? toTopic(r) : null;
  }

  countRequest(date: string) {
    this.db.prepare(`INSERT INTO daily_counter (date, requests) VALUES (?, 1)
      ON CONFLICT (date) DO UPDATE SET requests = requests + 1`).run(date);
  }
}
