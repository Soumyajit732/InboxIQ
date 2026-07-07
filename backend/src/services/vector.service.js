import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config.js';
import { db } from '../db/index.js';

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

const upsertTask = db.prepare(`
  INSERT INTO tasks (thread_id, task, deadline, priority, summary, confidence, embedding)
  VALUES (@thread_id, @task, @deadline, @priority, @summary, @confidence, @embedding)
  ON CONFLICT(thread_id) DO UPDATE SET
    task = excluded.task,
    deadline = excluded.deadline,
    priority = excluded.priority,
    summary = excluded.summary,
    confidence = excluded.confidence,
    embedding = excluded.embedding
`);

const selectAllTasks = db.prepare('SELECT * FROM tasks');

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

export async function storeEmail({ thread_id, email_text, task, deadline, priority, summary, confidence }) {
  const doc = `Task: ${task}\nSummary: ${summary}\nEmail: ${(email_text || '').slice(0, 600)}`;
  const embedding = await embed(doc);
  upsertTask.run({
    thread_id,
    task: task || '',
    deadline: deadline || '',
    priority,
    summary: summary || '',
    confidence,
    embedding: JSON.stringify(embedding),
  });
}

export async function searchEmails(query, topK = 5) {
  const rows = selectAllTasks.all();
  if (rows.length === 0) return [];

  const queryEmbedding = await embed(query);
  const results = rows.map(row => ({
    thread_id: row.thread_id,
    task: row.task,
    deadline: row.deadline || null,
    priority: row.priority,
    summary: row.summary,
    confidence: row.confidence,
    relevance_score: Math.round(cosineSimilarity(queryEmbedding, JSON.parse(row.embedding)) * 1000) / 1000,
  }));

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, topK);
}
