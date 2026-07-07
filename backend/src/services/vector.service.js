import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../data/vector-store.json');

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function persistStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(Object.fromEntries(store)));
}

const _store = loadStore();

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
  _store.set(thread_id, {
    thread_id,
    embedding,
    task: task || '',
    deadline: deadline || '',
    priority,
    summary: summary || '',
    confidence,
  });
  persistStore(_store);
}

export async function searchEmails(query, topK = 5) {
  if (_store.size === 0) return [];

  const queryEmbedding = await embed(query);
  const results = [..._store.values()].map(entry => ({
    thread_id: entry.thread_id,
    task: entry.task,
    deadline: entry.deadline || null,
    priority: entry.priority,
    summary: entry.summary,
    confidence: entry.confidence,
    relevance_score: Math.round(cosineSimilarity(queryEmbedding, entry.embedding) * 1000) / 1000,
  }));

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, topK);
}
