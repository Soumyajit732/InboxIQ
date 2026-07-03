import crypto from 'crypto';
import axios from 'axios';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../config.js';

const REFRESH_SKEW_MS = 60_000;
const sessions = new Map();

export function createSession({ email, accessToken, refreshToken, expiresIn }) {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  sessions.set(sessionId, {
    email,
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return sessionId;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

export function isExpired(session, now = Date.now()) {
  return now >= session.expiresAt - REFRESH_SKEW_MS;
}

export function updateAccessToken(sessionId, { accessToken, expiresIn }) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.accessToken = accessToken;
  session.expiresAt = Date.now() + expiresIn * 1000;
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
