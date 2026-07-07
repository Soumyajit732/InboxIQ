import { describe, it, expect } from 'vitest';
import { extractDeadline, analyzeWithChrono } from './deadline.service.js';

const REF = new Date('2026-07-07T10:00:00');

describe('extractDeadline', () => {
  it('returns null when no date is mentioned', () => {
    expect(extractDeadline('no dates here at all', REF)).toBeNull();
  });

  it('defaults to 17:00 when only a date is mentioned', () => {
    const deadline = extractDeadline('Please submit the report by tomorrow', REF);
    expect(deadline.getHours()).toBe(17);
    expect(deadline.getMinutes()).toBe(0);
  });

  it('keeps the explicit time when one is mentioned', () => {
    const deadline = extractDeadline('lets meet tomorrow at 3pm', REF);
    expect(deadline.getHours()).toBe(15);
  });

  it('resolves relative dates against the reference date', () => {
    const deadline = extractDeadline('due tomorrow', REF);
    expect(deadline.getDate()).toBe(REF.getDate() + 1);
  });
});

describe('analyzeWithChrono', () => {
  it('returns the same shape as the old spaCy fallback', () => {
    const result = analyzeWithChrono('Please submit the report by tomorrow');
    expect(result).toMatchObject({
      task: 'Derived from conversation',
      priority: 2,
      confidence: 0.5,
    });
    expect(result.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns a null deadline when nothing parses', () => {
    const result = analyzeWithChrono('just checking in, no dates');
    expect(result.deadline).toBeNull();
  });

  it('includes the matched date phrase as source_snippet and reasoning when a deadline is found', () => {
    const result = analyzeWithChrono('Please submit the report by tomorrow');
    expect(result.source_snippet).toBe('tomorrow');
    expect(result.reasoning).toMatch(/tomorrow/);
    expect(result.reasoning).toMatch(/chrono-node/);
    expect(result.deadline_source).toBe('chrono');
  });

  it('leaves source_snippet/reasoning/deadline_source null when nothing parses', () => {
    const result = analyzeWithChrono('just checking in, no dates');
    expect(result.source_snippet).toBeNull();
    expect(result.reasoning).toBeNull();
    expect(result.deadline_source).toBeNull();
  });
});
