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

// Guard against a pre-existing `tasks` table missing columns added in a later version
// (e.g. user_email, or the explainability/status fields below) -- CREATE TABLE IF NOT
// EXISTS would otherwise silently no-op against the old schema. This drops and
// recreates rather than attempting an in-place migration. Note this now also discards
// any status/snoozed_until the user had set (not just re-derivable extraction data) --
// acceptable at this project's single-developer scale, but a real migration (ALTER
// TABLE ADD COLUMN, which doesn't need this drop at all) would be worth it before this
// ever holds real multi-user data worth preserving across a schema change.
const REQUIRED_TASK_COLUMNS = [
  'user_email', 'thread_id', 'task', 'deadline', 'priority', 'summary', 'confidence',
  'embedding', 'source_snippet', 'reasoning', 'deadline_source', 'status', 'snoozed_until',
];
const existingTaskColumns = db.prepare("PRAGMA table_info(tasks)").all();
const hasStaleSchema = existingTaskColumns.length > 0
  && !REQUIRED_TASK_COLUMNS.every(name => existingTaskColumns.some(col => col.name === name));
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
    embedding TEXT NOT NULL,
    source_snippet TEXT,
    reasoning TEXT,
    deadline_source TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    snoozed_until TEXT,
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
