PRAGMA foreign_keys = ON;

CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(owner, revision)
);

CREATE INDEX idx_snapshots_owner_revision
  ON snapshots(owner, revision DESC);
