import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'doc-register.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  role      TEXT NOT NULL CHECK (role IN ('WAREHOUSE','GM','ACCOUNTING','ADMIN')),
  pin_hash  TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- ใบส่งมอบเอกสาร (ส่งเป็นชุดจาก GM ให้บัญชี)
CREATE TABLE IF NOT EXISTS handovers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  to_team      TEXT NOT NULL DEFAULT 'ACCOUNTING',
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  accepted_by  TEXT,
  accepted_at  TEXT,
  accepted_note TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_no        TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL CHECK (status IN ('INTAKE','REGISTERED','IN_TRANSIT','ACCEPTED')),
  doc_type      TEXT,
  doc_number    TEXT,
  doc_date      TEXT,
  vendor        TEXT,
  subject       TEXT,
  amount        REAL,
  copies        INTEGER,
  note          TEXT,
  intake_by     TEXT NOT NULL,
  intake_at     TEXT NOT NULL,
  registered_by TEXT,
  registered_at TEXT,
  handover_id   INTEGER REFERENCES handovers(id),
  accepted_by   TEXT,
  accepted_at   TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- ประวัติทุกการเปลี่ยนมือ (audit trail) แทนการลงชื่อในกระดาษ/Excel
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  actor       TEXT NOT NULL,
  detail      TEXT,
  at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_status  ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_intake  ON documents(intake_at);
CREATE INDEX IF NOT EXISTS idx_events_document   ON events(document_id);
CREATE INDEX IF NOT EXISTS idx_photos_document   ON photos(document_id);
`);

export const nowIso = () => new Date().toISOString();

export function logEvent(documentId, action, actor, detail = null) {
  db.prepare(
    'INSERT INTO events (document_id, action, actor, detail, at) VALUES (?, ?, ?, ?, ?)'
  ).run(documentId, action, actor, detail, nowIso());
}
