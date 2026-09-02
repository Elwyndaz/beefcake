-- Latmask-mejlet: valfritt per konto, ett brev per dag. owner är samma e-postadress som i snapshots.
CREATE TABLE reminders (
  owner TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_sent TEXT
);
