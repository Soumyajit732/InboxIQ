import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config.js';
import { db } from '../db/index.js';
import { effectiveStatus } from '../utils/task.utils.js';

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// status/snoozed_until are deliberately absent from both the column list and the
// ON CONFLICT SET clause below: a rescan should refresh what the email says, never
// what the user already decided to do about it. New rows fall back to the table's
// DEFAULT 'open'; existing rows keep whatever status they had untouched.
const upsertTask = db.prepare(`
  INSERT INTO tasks (
    user_email, thread_id, task, deadline, priority, summary, confidence, embedding,
    source_snippet, reasoning, deadline_source, sender
  )
  VALUES (
    @user_email, @thread_id, @task, @deadline, @priority, @summary, @confidence, @embedding,
    @source_snippet, @reasoning, @deadline_source, @sender
  )
  ON CONFLICT(user_email, thread_id) DO UPDATE SET
    task = excluded.task,
    deadline = excluded.deadline,
    priority = excluded.priority,
    summary = excluded.summary,
    confidence = excluded.confidence,
    embedding = excluded.embedding,
    source_snippet = excluded.source_snippet,
    reasoning = excluded.reasoning,
    deadline_source = excluded.deadline_source,
    sender = excluded.sender
`);

const selectTasksForUser = db.prepare('SELECT * FROM tasks WHERE user_email = ? ORDER BY priority DESC');

// Optional-predicate pattern: each filter is skipped entirely (via the `@x IS NULL OR`
// guard) when not provided, so this single prepared statement handles every filter
// combination rather than building SQL text per request.
const selectTasksForUserFiltered = db.prepare(`
  SELECT * FROM tasks
  WHERE user_email = @user_email
    AND (@priority_min IS NULL OR priority >= @priority_min)
    AND (@before IS NULL OR (deadline IS NOT NULL AND deadline != '' AND deadline <= @before))
    AND (@after IS NULL OR (deadline IS NOT NULL AND deadline != '' AND deadline >= @after))
    AND (@sender IS NULL OR sender LIKE @sender)
  ORDER BY priority DESC
`);

const updateStatusStmt = db.prepare(`
  UPDATE tasks SET status = ?, snoozed_until = ?
  WHERE user_email = ? AND thread_id = ?
`);

async function embed(text) {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
  const doc = `Task: ${task}\nSummary: ${summary}\nEmail: ${(email_text || '').slice(0, 600)}`;
  const embedding = await embed(doc);
  upsertTask.run({
    user_email,
    thread_id,
    task: task || '',
    deadline: deadline || '',
    priority,
    summary: summary || '',
    confidence,
    embedding: JSON.stringify(embedding),
    source_snippet: source_snippet || null,
    reasoning: reasoning || null,
    deadline_source: deadline_source || null,
    sender: sender || null,
  });
}

export async function searchEmails(userEmail, query, topK = 5, filters = {}) {
  const { status, priorityMin, before, after, sender } = filters;

  const rows = selectTasksForUserFiltered.all({
    user_email: userEmail,
    priority_min: priorityMin ?? null,
    before: before ?? null,
    after: after ?? null,
    sender: sender ? `%${sender}%` : null,
  });
  if (rows.length === 0) return [];

  const now = new Date();
  let tasks = rows.map(row => ({ row, task: rowToTask(row, now) }));
  if (status) {
    tasks = tasks.filter(({ task }) => task.status === status);
  }
  if (tasks.length === 0) return [];

  const queryEmbedding = await embed(query);
  const results = tasks.map(({ row, task }) => ({
    ...task,
    relevance_score: Math.round(cosineSimilarity(queryEmbedding, JSON.parse(row.embedding)) * 1000) / 1000,
  }));

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, topK);
}
