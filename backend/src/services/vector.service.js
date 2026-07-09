import axios from 'axios';
import { SPACY_SERVICE_URL } from '../config.js';
import { db } from '../db/index.js';
import { effectiveStatus } from '../utils/task.utils.js';
import { withRetry } from '../utils/http.utils.js';

// Chroma (via the Python service) only ever sees enough of a task to rank it --
// embeddings, priority, deadline, sender. It never learns about status, so a status
// filter can't be applied until after Node re-joins against SQLite below. Request a
// generously larger candidate pool than topK so that post-join status filtering
// doesn't silently return fewer results than asked for.
const SEARCH_CANDIDATE_POOL = 50;

// status/snoozed_until are deliberately absent from both the column list and the
// ON CONFLICT SET clause below: a rescan should refresh what the email says, never
// what the user already decided to do about it. New rows fall back to the table's
// DEFAULT 'open'; existing rows keep whatever status they had untouched.
const upsertTask = db.prepare(`
  INSERT INTO tasks (
    user_email, thread_id, task, deadline, priority, summary, confidence,
    source_snippet, reasoning, deadline_source, sender
  )
  VALUES (
    @user_email, @thread_id, @task, @deadline, @priority, @summary, @confidence,
    @source_snippet, @reasoning, @deadline_source, @sender
  )
  ON CONFLICT(user_email, thread_id) DO UPDATE SET
    task = excluded.task,
    deadline = excluded.deadline,
    priority = excluded.priority,
    summary = excluded.summary,
    confidence = excluded.confidence,
    source_snippet = excluded.source_snippet,
    reasoning = excluded.reasoning,
    deadline_source = excluded.deadline_source,
    sender = excluded.sender
`);

const selectTasksForUser = db.prepare('SELECT * FROM tasks WHERE user_email = ? ORDER BY priority DESC');
const updateStatusStmt = db.prepare(`
  UPDATE tasks SET status = ?, snoozed_until = ?
  WHERE user_email = ? AND thread_id = ?
`);

function getTasksByThreadIds(userEmail, threadIds) {
  if (threadIds.length === 0) return [];
  const placeholders = threadIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM tasks WHERE user_email = ? AND thread_id IN (${placeholders})`);
  return stmt.all(userEmail, ...threadIds);
}

function rowToTask(row, now = new Date()) {
  return {
    thread_id: row.thread_id,
    task: row.task,
    deadline: row.deadline || null,
    priority: row.priority,
    summary: row.summary,
    confidence: row.confidence,
    source_snippet: row.source_snippet || null,
    reasoning: row.reasoning || null,
    deadline_source: row.deadline_source || null,
    status: effectiveStatus(row.status, row.snoozed_until, now),
    snoozed_until: row.snoozed_until || null,
    sender: row.sender || null,
  };
}

export function getTasksForUser(userEmail, statusFilter = null) {
  const now = new Date();
  const tasks = selectTasksForUser.all(userEmail).map(row => rowToTask(row, now));
  if (!statusFilter) return tasks;
  return tasks.filter(t => t.status === statusFilter);
}

export function updateTaskStatus(userEmail, threadId, status, snoozedUntil = null) {
  const result = updateStatusStmt.run(status, snoozedUntil, userEmail, threadId);
  return result.changes > 0;
}

export async function storeEmail({
  user_email, thread_id, email_text, task, deadline, priority, summary, confidence,
  source_snippet, reasoning, deadline_source, sender,
}) {
  // SQLite is the source of truth for the task itself -- written first, unconditionally.
  upsertTask.run({
    user_email,
    thread_id,
    task: task || '',
    deadline: deadline || '',
    priority,
    summary: summary || '',
    confidence,
    source_snippet: source_snippet || null,
    reasoning: reasoning || null,
    deadline_source: deadline_source || null,
    sender: sender || null,
  });

  // The Python service owns embeddings/Chroma; this can fail independently of the
  // SQLite write above (e.g. the service is cold-starting) without losing the task --
  // it just won't be findable by search until the next successful sync.
  const doc = `Task: ${task}\nSummary: ${summary}\nEmail: ${(email_text || '').slice(0, 600)}`;
  await withRetry(() => axios.post(`${SPACY_SERVICE_URL}/vector/store`, {
    user_email,
    thread_id,
    doc_text: doc,
    priority: priority || 1,
    deadline: deadline || '',
    sender: sender || '',
  }));
}

export async function searchEmails(userEmail, query, topK = 5, filters = {}) {
  const { status, priorityMin, before, after, sender } = filters;

  const res = await withRetry(() => axios.get(`${SPACY_SERVICE_URL}/vector/search`, {
    params: {
      user_email: userEmail,
      q: query,
      top_k: SEARCH_CANDIDATE_POOL,
      priority_min: priorityMin,
      before,
      after,
      sender,
    },
  }));
  const ranked = res.data.results || [];
  if (ranked.length === 0) return [];

  const rows = getTasksByThreadIds(userEmail, ranked.map(r => r.thread_id));
  const rowsByThreadId = Object.fromEntries(rows.map(row => [row.thread_id, row]));
  const now = new Date();

  let merged = ranked
    .map(r => {
      const row = rowsByThreadId[r.thread_id];
      if (!row) return null; // Chroma had it, SQLite didn't -- shouldn't happen, don't crash on it
      return { ...rowToTask(row, now), relevance_score: r.relevance_score };
    })
    .filter(Boolean);

  if (status) {
    merged = merged.filter(t => t.status === status);
  }

  return merged.slice(0, topK);
}
