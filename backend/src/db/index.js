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

// Guard against a pre-existing `tasks` table from before user_email was added to the
// primary key -- CREATE TABLE IF NOT EXISTS below would otherwise silently no-op against
// the old schema. Old rows have no reliable owner to backfill, so this drops and
// recreates rather than attempting an in-place migration (acceptable: this data is a
// derived cache re-populated by the next Gmail sync, not a source of truth).
const existingTaskColumns = db.prepare("PRAGMA table_info(tasks)").all();
const hasStaleSchema = existingTaskColumns.length > 0
  && !existingTaskColumns.some(col => col.name === 'user_email');
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
