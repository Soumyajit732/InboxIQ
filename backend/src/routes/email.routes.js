import { Router } from 'express';
import { analyzeEmailThread } from '../services/nlp.service.js';
import { fetchThreads } from '../services/gmail.service.js';
import { storeEmail } from '../services/vector.service.js';
import { filterLowConfidence, sortByPriority } from '../utils/pipeline.utils.js';
import { requireSession } from '../middleware/auth.middleware.js';

const router = Router();
const CACHE = new Map();
const CACHE_TTL = 60_000;

router.post('/analyze', requireSession, async (req, res) => {
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

router.get('/gmail', requireSession, async (req, res) => {
  const { id: sessionId, accessToken, email: userEmail } = req.session;

  const now = Date.now();
  const cached = CACHE.get(sessionId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const threads = await fetchThreads(accessToken, 20);

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
          await storeEmail({
            user_email: userEmail,
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
    CACHE.set(sessionId, { data: response, timestamp: now });
    res.json(response);
  } catch (err) {
    console.error('GMAIL ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

export default router;
