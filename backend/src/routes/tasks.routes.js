import { Router } from 'express';
import { getTasksForUser, updateTaskStatus } from '../services/vector.service.js';
import { requireSession } from '../middleware/auth.middleware.js';
import { isValidStatus, VALID_STATUSES } from '../utils/task.utils.js';

const router = Router();

router.get('/tasks', requireSession, (req, res) => {
  const { status } = req.query;
  if (status && !isValidStatus(status)) {
    return res.status(400).json({ detail: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  res.json({ tasks: getTasksForUser(req.session.email, status || null) });
});

router.patch('/tasks/:thread_id', requireSession, (req, res) => {
  const { status, snoozed_until } = req.body;

  if (!isValidStatus(status)) {
    return res.status(400).json({ detail: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (status === 'snoozed' && (!snoozed_until || isNaN(new Date(snoozed_until).getTime()))) {
    return res.status(400).json({ detail: 'snoozed_until (a valid ISO datetime) is required when status is "snoozed"' });
  }

  const updated = updateTaskStatus(
    req.session.email,
    req.params.thread_id,
    status,
    status === 'snoozed' ? snoozed_until : null,
  );
  if (!updated) {
    return res.status(404).json({ detail: 'Task not found' });
  }
  res.json({ status: 'ok' });
});

export default router;
