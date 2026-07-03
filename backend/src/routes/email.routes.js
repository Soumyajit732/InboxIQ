import { Router } from 'express';
import axios from 'axios';
import { analyzeEmailThread } from '../services/nlp.service.js';
import { fetchThreads } from '../services/gmail.service.js';
import { processAllThreads } from '../services/thread.service.js';
import { computePriority } from '../services/priority.service.js';
import { filterLowConfidence, sortByPriority } from '../utils/pipeline.utils.js';
import { SPACY_SERVICE_URL } from '../config.js';

const router = Router();
const CACHE = new Map();
const CACHE_TTL = 60_000;

router.post('/analyze', async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) {
    return res.status(400).json({ detail: 'No messages provided' });
  }
  try {
    res.json(await analyzeEmailThread(messages));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

router.get('/gmail', async (req, res) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing or invalid Authorization header' });
  }

  const token = authorization.slice(7).trim();
  if (!token || token === 'null') {
    return res.status(401).json({ detail: 'Invalid token' });
  }

  console.log('TOKEN RECEIVED:', token.slice(0, 20));

  const now = Date.now();
  const cached = CACHE.get(token);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log('Returning cached data');
    return res.json(cached.data);
  }

  try {
    const threads = await fetchThreads(token, 20);

    const settled = await Promise.allSettled(
      threads.map(async t => {
        if (!t.messages?.length) return null;
        const result = await analyzeEmailThread(t.messages);
        if (!result || result.task === null) return null;
        return { ...result, thread_id: t.thread_id };
      }),
    );

    let results = settled
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    results = filterLowConfidence(results);
    results = sortByPriority(results);

    const threadTextMap = Object.fromEntries(threads.map(t => [t.thread_id, t.messages[0]]));
    for (const r of results) {
      if (r.thread_id) {
        try {
          await axios.post(`${SPACY_SERVICE_URL}/vector/store`, {
            thread_id: r.thread_id,
            email_text: threadTextMap[r.thread_id] || '',
            task: r.task || '',
            deadline: r.deadline || '',
            priority: r.priority || 1,
            summary: r.summary || '',
            confidence: r.confidence || 0.5,
          });
        } catch (e) {
          console.warn('Vector store error:', e.message);
        }
      }
    }

    const response = { total_tasks: results.length, tasks: results };
    CACHE.set(token, { data: response, timestamp: now });
    res.json(response);
  } catch (err) {
    console.error('GMAIL ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

router.post('/process-all-threads', async (req, res) => {
  try {
    let results = await processAllThreads(req.body);
    results = results.map(r => ({
      ...r,
      priority: computePriority(r.combined_text || '', r.deadline, 'thread'),
    }));
    res.json(results);
  } catch (err) {
    console.error('THREAD ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

export default router;
