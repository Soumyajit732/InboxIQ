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
