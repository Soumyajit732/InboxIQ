import { describe, it, expect } from 'vitest';
import { createSession, getSession, deleteSession, isExpired, updateAccessToken } from './session.service.js';

describe('session.service', () => {
  it('creates a session and retrieves it by id', () => {
    const id = createSession({ email: 'a@b.com', accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 });
    const session = getSession(id);
    expect(session).toMatchObject({ email: 'a@b.com', accessToken: 'at', refreshToken: 'rt' });
  });

  it('returns null for an unknown session id', () => {
    expect(getSession('does-not-exist')).toBeNull();
  });

  it('deletes a session', () => {
    const id = createSession({ email: 'a@b.com', accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 });
    deleteSession(id);
    expect(getSession(id)).toBeNull();
  });

  it('isExpired accounts for the refresh skew window', () => {
    const session = { expiresAt: Date.now() + 30_000 };
    expect(isExpired(session)).toBe(true);
    expect(isExpired({ expiresAt: Date.now() + 3600_000 })).toBe(false);
  });

  it('updateAccessToken refreshes the token and expiry', () => {
    const id = createSession({ email: 'a@b.com', accessToken: 'old', refreshToken: 'rt', expiresIn: 3600 });
    const before = getSession(id).expiresAt;
    updateAccessToken(id, { accessToken: 'new', expiresIn: 7200 });
    const session = getSession(id);
    expect(session.accessToken).toBe('new');
    expect(session.expiresAt).toBeGreaterThan(before);
  });
});
