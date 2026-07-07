import { Router } from 'express';
import { searchEmails } from '../services/vector.service.js';
import { requireSession } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/search', requireSession, async (req, res) => {
  const { q, top_k = 5 } = req.query;
  if (!q?.trim()) {
    return res.status(400).json({ detail: 'Query cannot be empty' });
  }

  try {
    const results = await searchEmails(req.session.email, q.trim(), Number(top_k));
    res.json({ query: q, results });
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

export default router;
