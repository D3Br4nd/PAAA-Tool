/**
 * Local-first schema (SQLite) meant to mirror the server-side tenant DB.
 * Keep this close to your Drizzle schema to reduce drift.
 *
 * NOTE: This is plain SQL for the client-side bootstrap. You can generate it
 * from Drizzle later if you want.
 */

export const LOCAL_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Events (CaTE Module - event editions like "Evolution 2026")
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 0,
  theme_config TEXT, -- JSON for UI customization
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_uq ON events(slug);

-- Factions (CaTE Module - macro-groups per event, e.g., "Precettorie")
CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  avatar_url TEXT,
  faction_type TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS factions_event_idx ON factions(event_id);

-- Faction Managers (N:N junction table)
CREATE TABLE IF NOT EXISTS faction_managers (
  faction_id TEXT NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (faction_id, user_id)
);

CREATE INDEX IF NOT EXISTS faction_managers_faction_idx ON faction_managers(faction_id);
CREATE INDEX IF NOT EXISTS faction_managers_user_idx ON faction_managers(user_id);

-- Teams (updated to link to factions)
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  score_cache INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  current_phase_id TEXT,
  faction_id TEXT REFERENCES factions(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS teams_faction_idx ON teams(faction_id);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase_id TEXT,
  challenge_type TEXT NOT NULL DEFAULT 'program',
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scoring_type TEXT NOT NULL,
  base_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER,
  has_ranking_bonus INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Example local-only table tracking team progress (still mirrors likely server intent)
CREATE TABLE IF NOT EXISTS team_completions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL,
  UNIQUE(team_id, challenge_id)
);

-- Mutation Queue (outbox pattern)
CREATE TABLE IF NOT EXISTS mutation_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- e.g. "team.completed_challenge"
  payload_json TEXT NOT NULL,       -- serialized JSON payload
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mutation_queue_status_created
  ON mutation_queue(status, created_at);
`;
