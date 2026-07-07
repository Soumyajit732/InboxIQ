import { describe, it, expect } from 'vitest';
import { isValidStatus, effectiveStatus } from './task.utils.js';

describe('isValidStatus', () => {
  it('accepts all five lifecycle statuses', () => {
    for (const s of ['open', 'done', 'snoozed', 'dismissed', 'archived']) {
      expect(isValidStatus(s)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isValidStatus('deleted')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe('effectiveStatus', () => {
  const now = new Date('2026-07-07T12:00:00');

  it('passes through non-snoozed statuses unchanged', () => {
    for (const s of ['open', 'done', 'dismissed', 'archived']) {
      expect(effectiveStatus(s, null, now)).toBe(s);
    }
  });

  it('stays snoozed while snoozed_until is in the future', () => {
    expect(effectiveStatus('snoozed', '2026-07-08T09:00:00', now)).toBe('snoozed');
  });

  it('reverts to open once snoozed_until has passed', () => {
    expect(effectiveStatus('snoozed', '2026-07-07T09:00:00', now)).toBe('open');
  });

  it('reverts to open exactly at the snoozed_until boundary', () => {
    expect(effectiveStatus('snoozed', '2026-07-07T12:00:00', now)).toBe('open');
  });

  it('treats snoozed with no snoozed_until as still snoozed (defensive, should not happen in practice)', () => {
    expect(effectiveStatus('snoozed', null, now)).toBe('snoozed');
  });
});
