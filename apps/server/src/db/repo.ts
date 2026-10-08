import Database from 'better-sqlite3';
import { ArtistNotes, Conversation, Run, type ConversationView, type IrisFeedback, type RunState, type Speakers, type Turn } from '@crosstalk/shared';
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
  episode: number; speakers_json: string; parent_id: string | null; branch_turn_id: string | null; created_at: string; updated_at: string;
};
type TurnRow = {
  id: string; conversation_id: string; seq: number; speaker_id: string; model_id: string; objective: string;
  text: string; status: string; created_at: string;
};
type RunRow = {
  id: string; conversation_id: string; state: string; from_seq: number; to_seq: number; started_at: string;
  ended_at: string | null; stop_reason: string | null; pause_requested: number;
};

const toConversation = (r: ConvRow): Conversation => Conversation.parse({
  id: r.id, title: r.title, topic: r.topic, mode: r.mode, format: r.format, audience: r.audience,
  temperature: r.temperature, episode: r.episode, speakers: JSON.parse(r.speakers_json) as Speakers,
  parentId: r.parent_id, branchTurnId: r.branch_turn_id, createdAt: r.created_at, updatedAt: r.updated_at,
});
const toTurn = (r: TurnRow): Turn => ({
  id: r.id, conversationId: r.conversation_id, seq: r.seq, speakerId: r.speaker_id as Turn['speakerId'],
  modelId: r.model_id, objective: r.objective, text: r.text, status: 'completed', createdAt: r.created_at,
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
      (id, title, topic, mode, format, audience, temperature, episode, speakers_json, parent_id, branch_turn_id, created_at, updated_at)
      VALUES (@id, @title, @topic, @mode, @format, @audience, @temperature, @episode, @speakers, @parentId, @branchTurnId, @createdAt, @updatedAt)`)
      .run({ ...c, speakers: JSON.stringify(c.speakers) });
  }

  getConversation(id: string): Conversation | null {
    const r = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConvRow | undefined;
    return r ? toConversation(r) : null;
  }

  listConversations(): Conversation[] {
    return (this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as ConvRow[]).map(toConversation);
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
    const res = this.db.prepare(`INSERT INTO turns (id, conversation_id, seq, speaker_id, model_id, objective, text, status, created_at)
      VALUES (@id, @conversationId, @seq, @speakerId, @modelId, @objective, @text, @status, @createdAt)
      ON CONFLICT (conversation_id, seq) DO NOTHING`).run(t);
    return res.changes === 1;
  }

  listTurns(conversationId: string): Turn[] {
    return (this.db.prepare(`SELECT * FROM turns WHERE conversation_id = ? AND status = 'completed' ORDER BY seq`)
      .all(conversationId) as TurnRow[]).map(toTurn);
  }

  lastSeq(conversationId: string): number {
    const r = this.db.prepare(`SELECT MAX(seq) AS s FROM turns WHERE conversation_id = ? AND status = 'completed'`).get(conversationId) as { s: number | null };
    return r.s ?? 0;
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
    return { ...c, turns: this.listTurns(id), run: this.latestRun(id), interventions: [], artist: this.getArtist(id) };
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
        created_at = excluded.created_at`).run(a);
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

  countRequest(date: string) {
    this.db.prepare(`INSERT INTO daily_counter (date, requests) VALUES (?, 1)
      ON CONFLICT (date) DO UPDATE SET requests = requests + 1`).run(date);
  }
}
