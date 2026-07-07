import { Router } from 'express';
import { searchEmails } from '../services/vector.service.js';
import { requireSession } from '../middleware/auth.middleware.js';
import { isValidStatus, VALID_STATUSES } from '../utils/task.utils.js';

const router = Router();

router.get('/search', requireSession, async (req, res) => {
  const { q, top_k = 5, status, priority_min, before, after, sender } = req.query;
  if (!q?.trim()) {
    return res.status(400).json({ detail: 'Query cannot be empty' });
  }

  if (status && !isValidStatus(status)) {
    return res.status(400).json({ detail: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  let priorityMin;
  if (priority_min !== undefined) {
    priorityMin = Number(priority_min);
    if (!Number.isInteger(priorityMin) || priorityMin < 1 || priorityMin > 5) {
      return res.status(400).json({ detail: 'priority_min must be an integer between 1 and 5' });
    }
  }

  for (const [label, value] of [['before', before], ['after', after]]) {
    if (value !== undefined && isNaN(new Date(value).getTime())) {
      return res.status(400).json({ detail: `${label} must be a valid ISO datetime` });
    }
  }

  try {
    const results = await searchEmails(req.session.email, q.trim(), Number(top_k), {
      status: status || undefined,
      priorityMin,
      before: before || undefined,
      after: after || undefined,
      sender: sender?.trim() || undefined,
    });
    res.json({ query: q, results });
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

export default router;
