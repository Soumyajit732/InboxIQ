import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/inboxiq.db');

function resolveDbTarget() {
  if (process.env.NODE_ENV === 'test') return ':memory:';
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  return DB_PATH;
}

export const db = new Database(resolveDbTarget());

// Guard against a pre-existing `tasks` table whose columns don't match what's expected
// -- CREATE TABLE IF NOT EXISTS would otherwise silently no-op against a stale schema.
// Checked as an exact set match (not just "required columns present"), since this
// branch also *removes* a column (embedding, now owned by Chroma instead of SQLite) --
// a pure subset check would miss a leftover NOT NULL `embedding` column from an older
// run and every insert would then fail. Drops and recreates rather than an in-place
// migration; note this discards status/snoozed_until too, not just re-derivable
// extraction data -- acceptable at this project's single-developer scale.
const REQUIRED_TASK_COLUMNS = [
  'user_email', 'thread_id', 'task', 'deadline', 'priority', 'summary', 'confidence',
  'source_snippet', 'reasoning', 'deadline_source', 'status', 'snoozed_until', 'sender',
];
const existingTaskColumns = db.prepare("PRAGMA table_info(tasks)").all();
const existingColumnNames = existingTaskColumns.map(col => col.name).sort();
const hasStaleSchema = existingTaskColumns.length > 0
  && JSON.stringify(existingColumnNames) !== JSON.stringify([...REQUIRED_TASK_COLUMNS].sort());
if (hasStaleSchema) {
  db.exec('DROP TABLE tasks');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    user_email TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    task TEXT,
    deadline TEXT,
    priority INTEGER,
    summary TEXT,
    confidence REAL,
    source_snippet TEXT,
    reasoning TEXT,
    deadline_source TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    snoozed_until TEXT,
    sender TEXT,
    PRIMARY KEY (user_email, thread_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER NOT NULL
  );
`);
