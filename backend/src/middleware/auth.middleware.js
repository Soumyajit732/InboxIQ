import {
  getSession,
  deleteSession,
  isExpired,
  updateAccessToken,
  refreshAccessToken,
} from '../services/session.service.js';

export async function requireSession(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing or invalid Authorization header' });
  }

  const sessionId = authorization.slice(7).trim();
  let session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ detail: 'Invalid or expired session' });
  }

  if (isExpired(session)) {
    if (!session.refreshToken) {
      deleteSession(sessionId);
      return res.status(401).json({ detail: 'Session expired' });
    }
    try {
      const refreshed = await refreshAccessToken(session.refreshToken);
      updateAccessToken(sessionId, refreshed);
      session = getSession(sessionId);
    } catch (err) {
      console.error('[Session] refresh failed:', err.message);
      deleteSession(sessionId);
      return res.status(401).json({ detail: 'Session expired' });
    }
  }

  req.session = { id: sessionId, ...session };
  next();
}
