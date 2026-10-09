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
  `
  -- Usage is an audit of what was spent, so it outlives deleted episodes (no cascading foreign keys).
  CREATE TABLE provider_usage_v2 (
    id               TEXT PRIMARY KEY,
    run_id           TEXT NOT NULL,
    conversation_id  TEXT NOT NULL,
    seq              INTEGER NOT NULL,
    attempt          INTEGER NOT NULL,
    provider         TEXT NOT NULL,
    model_id         TEXT NOT NULL,
    status           TEXT NOT NULL,
    error            TEXT,
    latency_ms       INTEGER NOT NULL,
    tokens_in        INTEGER,
    tokens_out       INTEGER,
    cost_usd         REAL,
    date             TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );
  INSERT INTO provider_usage_v2 SELECT id, run_id, conversation_id, seq, attempt, provider, model_id, status, error,
    latency_ms, tokens_in, tokens_out, cost_usd, date, created_at FROM provider_usage;
  DROP TABLE provider_usage;
  ALTER TABLE provider_usage_v2 RENAME TO provider_usage;
  CREATE INDEX usage_by_date ON provider_usage(date);
  `,
  `
  -- Milestone 7: Topic Scout. Topics stay after newer runs, because episodes made from them keep their brief.
  CREATE TABLE scout_runs (
    id                         TEXT PRIMARY KEY,
    date                       TEXT NOT NULL,
    started_at                 TEXT NOT NULL,
    state                      TEXT NOT NULL CHECK (state IN ('running', 'ok', 'failed')),
    error                      TEXT,
    sources_ok                 TEXT NOT NULL DEFAULT '[]',
    sources_failed             TEXT NOT NULL DEFAULT '[]',
    scheduled                  INTEGER NOT NULL DEFAULT 0,
    autopilot_conversation_id  TEXT,
    autopilot_note             TEXT
  );
  CREATE INDEX scout_runs_by_date ON scout_runs(date, started_at);

  CREATE TABLE scout_topics (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES scout_runs(id),
    date        TEXT NOT NULL,
    rank        INTEGER NOT NULL,
    question    TEXT NOT NULL,
    category    TEXT NOT NULL,
    region      TEXT NOT NULL,
    split       INTEGER NOT NULL,
    buzz        INTEGER NOT NULL,
    bullets     TEXT NOT NULL,
    sources     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  -- Small app settings, such as the Scout preferences, as JSON by key.
  CREATE TABLE settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  ALTER TABLE conversations ADD COLUMN scout_topic_id TEXT;
  `,
  `
  -- Mind-change meter: how sure a host said they were, on their first and last lines.
  ALTER TABLE turns ADD COLUMN stance INTEGER;
  `,
  `
  -- Milestone 8: Control room.
  ALTER TABLE conversations ADD COLUMN publish TEXT;
  ALTER TABLE scout_topics ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE scout_topics ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

  -- Producer notes ('note') join the cue kinds: rebuild the table to widen its check.
  CREATE TABLE interventions_v2 (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL CHECK (kind IN ('challenge', 'deeper', 'temp', 'guest', 'note')),
    text                TEXT,
    target_seq          INTEGER,
    from_temp           TEXT,
    to_temp             TEXT,
    applies_before_seq  INTEGER NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('queued', 'applied', 'cancelled')),
    created_at          TEXT NOT NULL
  );
  INSERT INTO interventions_v2 SELECT id, conversation_id, kind, text, target_seq, from_temp, to_temp, applies_before_seq, status, created_at FROM interventions;
  DROP TABLE interventions;
  ALTER TABLE interventions_v2 RENAME TO interventions;
  CREATE INDEX cues_by_conversation ON interventions(conversation_id, applies_before_seq);

  -- Every admin action, newest last.
  CREATE TABLE admin_audit (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT NOT NULL,
    action  TEXT NOT NULL,
    detail  TEXT NOT NULL
  );
  `,
  `
  -- Episodes that finished before publishing existed also wait for the owner's OK.
  UPDATE conversations SET publish = 'waiting'
    WHERE publish IS NULL AND id IN (SELECT conversation_id FROM generation_runs WHERE state = 'completed');
  `,
  `
  -- Hot seat: the listener's verdict on who moved them.
  ALTER TABLE conversations ADD COLUMN verdict TEXT;
  `,
  `
  -- Iris paints: set when the listener picks the style themselves, so she can learn their taste.
  ALTER TABLE artist_notes ADD COLUMN style_by_listener INTEGER NOT NULL DEFAULT 0;
  `,
  `
  -- Where do you stand? The listener's own 0-100 on the question, before and after the episode.
  ALTER TABLE conversations ADD COLUMN you_start INTEGER;
  ALTER TABLE conversations ADD COLUMN you_end INTEGER;
  `,
  `
  -- Round two: a sequel with the same hosts and question, picking up where the last round ended.
  ALTER TABLE conversations ADD COLUMN round_of TEXT;
  ALTER TABLE conversations ADD COLUMN round INTEGER NOT NULL DEFAULT 1;
  CREATE INDEX IF NOT EXISTS conversations_round_of ON conversations(round_of);
  `,
  `
  -- Iris's gallery keeps every version: each drawing she makes, in each style it was shown in.
  CREATE TABLE artworks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    version          INTEGER NOT NULL,
    art_style        TEXT NOT NULL,
    art_title        TEXT NOT NULL,
    caption          TEXT NOT NULL DEFAULT '',
    moment_seq       INTEGER NOT NULL DEFAULT 0,
    sketch_svg       TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    UNIQUE (conversation_id, version, art_style)
  );
  INSERT OR IGNORE INTO artworks (conversation_id, version, art_style, art_title, caption, moment_seq, sketch_svg, created_at)
    SELECT conversation_id, version, art_style, art_title, caption, moment_seq, sketch_svg, created_at
    FROM artist_notes WHERE state = 'done' AND sketch_svg IS NOT NULL;
  `,
  `
  -- Episode length: short (8 turns), normal (16) or long (24).
  ALTER TABLE conversations ADD COLUMN length TEXT NOT NULL DEFAULT 'normal';
  `,
  `
  -- Photo portraits of the invented hosts, fetched once per look and kept (backed up with the rest).
  CREATE TABLE portraits (
    code        TEXT PRIMARY KEY,
    mime        TEXT NOT NULL,
    data        BLOB NOT NULL,
    created_at  TEXT NOT NULL
  );
  `,
  `
  -- The language an episode is spoken in.
  ALTER TABLE conversations ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
  `,
  `
  -- Listener reactions while an episode plays (an emoji on a line).
  CREATE TABLE reactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL,
    kind             TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );
  CREATE INDEX reactions_by_conversation ON reactions (conversation_id, seq);
  `,
  `
  -- Iris's real paintings: one per drawing version, made by a free image service from her own brief.
  ALTER TABLE artworks ADD COLUMN image_prompt TEXT NOT NULL DEFAULT '';
  CREATE TABLE iris_pictures (
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    version          INTEGER NOT NULL,
    mime             TEXT NOT NULL,
    data             BLOB NOT NULL,
    created_at       TEXT NOT NULL,
    PRIMARY KEY (conversation_id, version)
  );
  `,
  `
  -- A line the host meant as a joke: their co-host laughs along.
  ALTER TABLE turns ADD COLUMN funny INTEGER NOT NULL DEFAULT 0;
  `,
];
