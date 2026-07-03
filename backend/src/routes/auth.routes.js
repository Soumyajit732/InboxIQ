import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
  FRONTEND_URL,
} from '../config.js';

const router = Router();
const _pending = new Map();

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

router.get('/auth/login', (req, res) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  res.redirect(url.toString());
});

router.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error || !code) {
    const detail = error_description || error || 'missing_code';
    return res.redirect(`${FRONTEND_URL}?auth_error=${detail}`);
  }

  try {
    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    );

    const { access_token } = tokenRes.data;

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const email = userRes.data.email || '';
    const opaqueCode = crypto.randomBytes(32).toString('base64url');

    _pending.set(opaqueCode, {
      token: access_token,
      email,
      expires: Date.now() + 120_000,
    });

    res.redirect(`${FRONTEND_URL}?code=${opaqueCode}`);
  } catch (err) {
    console.error('[OAuth] callback error:', err.message);
    res.redirect(`${FRONTEND_URL}?auth_error=token_exchange_failed`);
  }
});

router.post('/auth/exchange', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ detail: 'Missing code' });

  const entry = _pending.get(code);
  _pending.delete(code);

  if (!entry) return res.status(400).json({ detail: 'Invalid or expired code' });
  if (Date.now() > entry.expires) return res.status(400).json({ detail: 'Code expired' });

  res.json({ token: entry.token, email: entry.email });
});

export default router;
