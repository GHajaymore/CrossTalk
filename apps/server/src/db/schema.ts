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
  `
  -- One row per provider attempt, including retries and failures. Never stores prompts or keys.
  CREATE TABLE provider_usage (
    id               TEXT PRIMARY KEY,
    run_id           TEXT NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL,
    attempt          INTEGER NOT NULL,
    provider         TEXT NOT NULL,
    model_id         TEXT NOT NULL,
    status           TEXT NOT NULL,
    error            TEXT,
    latency_ms       INTEGER NOT NULL,
    tokens_in        INTEGER,
    tokens_out       INTEGER,
    cost_usd         REAL,       -- NULL means unknown, never $0
    date             TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );
  CREATE INDEX usage_by_date ON provider_usage(date);
  `,
  `
  -- Iris, the Artist: one row per conversation (her latest drawing).
  CREATE TABLE artist_notes (
    conversation_id  TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    state            TEXT NOT NULL,
    model_id         TEXT NOT NULL,
    perspective      TEXT NOT NULL DEFAULT '',
    moment_seq       INTEGER NOT NULL DEFAULT 0,
    caption          TEXT NOT NULL DEFAULT '',
    art_title        TEXT NOT NULL DEFAULT '',
    art_style        TEXT NOT NULL DEFAULT 'sketch',
    sketch_svg       TEXT,
    image_prompt     TEXT NOT NULL DEFAULT '',
    error            TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL
  );

  -- What the listener tells Iris about her work; she reads recent notes before drawing.
  CREATE TABLE iris_feedback (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT REFERENCES conversations(id) ON DELETE SET NULL,
    rating           TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    note             TEXT NOT NULL DEFAULT '',
    art_title        TEXT,
    created_at       TEXT NOT NULL
  );
  `,
  `
  -- Milestone 4. Branches read their parent's turns up to branch_seq; they never copy or change them.
  ALTER TABLE conversations ADD COLUMN branch_seq INTEGER;
  ALTER TABLE conversations ADD COLUMN branch_direction TEXT;

  -- Listener cues: a note that lands at a turn boundary (challenge, go deeper, temperature, a guest on the mic).
  CREATE TABLE interventions (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL CHECK (kind IN ('challenge', 'deeper', 'temp', 'guest')),
    text                TEXT,
    target_seq          INTEGER,
    from_temp           TEXT,
    to_temp             TEXT,
    applies_before_seq  INTEGER NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('queued', 'applied', 'cancelled')),
    created_at          TEXT NOT NULL
  );
  CREATE INDEX cues_by_conversation ON interventions(conversation_id, applies_before_seq);
  `,
];
