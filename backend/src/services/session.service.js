import crypto from 'crypto';
import axios from 'axios';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../config.js';
import { db } from '../db/index.js';

const REFRESH_SKEW_MS = 60_000;

const insertSession = db.prepare(`
  INSERT INTO sessions (id, email, access_token, refresh_token, expires_at)
  VALUES (?, ?, ?, ?, ?)
`);
const selectSession = db.prepare('SELECT * FROM sessions WHERE id = ?');
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
const updateAccessTokenStmt = db.prepare('UPDATE sessions SET access_token = ?, expires_at = ? WHERE id = ?');

function toSession(row) {
  if (!row) return null;
  return {
    email: row.email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  };
}

export function createSession({ email, accessToken, refreshToken, expiresIn }) {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + expiresIn * 1000;
  insertSession.run(sessionId, email, accessToken, refreshToken, expiresAt);
  return sessionId;
}

export function getSession(sessionId) {
  return toSession(selectSession.get(sessionId));
}

export function deleteSession(sessionId) {
  deleteSessionStmt.run(sessionId);
}

export function isExpired(session, now = Date.now()) {
  return now >= session.expiresAt - REFRESH_SKEW_MS;
}

export function updateAccessToken(sessionId, { accessToken, expiresIn }) {
  const expiresAt = Date.now() + expiresIn * 1000;
  updateAccessTokenStmt.run(accessToken, expiresAt, sessionId);
}

export async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  );
  return res.data;
}
