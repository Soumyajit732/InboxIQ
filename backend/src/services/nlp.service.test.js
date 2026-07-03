import { describe, it, expect } from 'vitest';
import { computePriority } from './nlp.service.js';

describe('computePriority', () => {
  it('returns 5 for a deadline already in the past', () => {
    expect(computePriority('Submit report', new Date(Date.now() - 3600_000).toISOString())).toBe(5);
  });

  it('scores a deadline within 6 hours higher than one within 72 hours', () => {
    const soon = computePriority('Reply', new Date(Date.now() + 3 * 3600_000).toISOString());
    const later = computePriority('Reply', new Date(Date.now() + 48 * 3600_000).toISOString());
    expect(soon).toBeGreaterThan(later);
  });

  it('bumps score for urgent keywords', () => {
    const withKeyword = computePriority('This is urgent, please help', null);
    const without = computePriority('Just checking in', null);
    expect(withKeyword).toBeGreaterThan(without);
  });

  it('clamps the score at 5 even when deadline and keyword bonuses would exceed it', () => {
    const score = computePriority('urgent asap deadline', new Date(Date.now() + 3 * 3600_000).toISOString());
    expect(score).toBe(5);
  });

  it('defaults to 1 with no deadline or keywords', () => {
    expect(computePriority('', null)).toBe(1);
  });

  it('falls through to the lowest deadline bucket for an unparseable deadline', () => {
    // NaN comparisons are always false, so an invalid date lands in the final `else` branch
    // rather than being treated as "no deadline" -- this asserts the actual (not ideal) behavior.
    expect(computePriority('Reply', 'not-a-date')).toBe(2);
  });
});
