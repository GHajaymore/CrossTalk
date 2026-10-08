// SQLite schema. Each entry is one migration; PRAGMA user_version records how many have run.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE conversations (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    topic           TEXT NOT NULL,
    mode            TEXT NOT NULL,
    format          TEXT NOT NULL,
    audience        TEXT NOT NULL,
    temperature     TEXT NOT NULL,
    episode         INTEGER NOT NULL,
    speakers_json   TEXT NOT NULL,
    parent_id       TEXT REFERENCES conversations(id),
    branch_turn_id  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  -- A turn row is written only when the turn is complete. The unique key makes saving idempotent.
  CREATE TABLE turns (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL,
    speaker_id       TEXT NOT NULL,
    model_id         TEXT NOT NULL,
    objective        TEXT NOT NULL,
    text             TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    created_at       TEXT NOT NULL,
    UNIQUE (conversation_id, seq)
  );

  CREATE TABLE generation_runs (
    id                TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    state             TEXT NOT NULL,
    from_seq          INTEGER NOT NULL,
    to_seq            INTEGER NOT NULL,
    started_at        TEXT NOT NULL,
    ended_at          TEXT,
    stop_reason       TEXT,
    pause_requested   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX runs_by_conversation ON generation_runs(conversation_id, started_at);
  CREATE INDEX runs_by_state ON generation_runs(state);

  -- Counts every attempted provider request, per local date.
  CREATE TABLE daily_counter (
    date      TEXT PRIMARY KEY,
    requests  INTEGER NOT NULL DEFAULT 0
  );
  `,
];
