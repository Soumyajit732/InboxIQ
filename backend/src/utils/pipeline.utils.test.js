import { describe, it, expect } from 'vitest';
import { sortByPriority, filterLowConfidence } from './pipeline.utils.js';

describe('sortByPriority', () => {
  it('sorts descending by priority without mutating the input', () => {
    const input = [{ priority: 2 }, { priority: 5 }, { priority: 3 }];
    const sorted = sortByPriority(input);
    expect(sorted.map(r => r.priority)).toEqual([5, 3, 2]);
    expect(input.map(r => r.priority)).toEqual([2, 5, 3]);
  });

  it('treats missing priority as 1', () => {
    const sorted = sortByPriority([{ priority: 3 }, {}]);
    expect(sorted[0].priority).toBe(3);
    expect(sorted[1].priority).toBeUndefined();
  });
});

describe('filterLowConfidence', () => {
  it('drops results below the default threshold', () => {
    const results = [{ confidence: 0.9 }, { confidence: 0.2 }, { confidence: 0.4 }];
    expect(filterLowConfidence(results)).toEqual([{ confidence: 0.9 }, { confidence: 0.4 }]);
  });

  it('respects a custom threshold', () => {
    const results = [{ confidence: 0.5 }, { confidence: 0.6 }];
    expect(filterLowConfidence(results, 0.55)).toEqual([{ confidence: 0.6 }]);
  });

  it('treats missing confidence as 0', () => {
    expect(filterLowConfidence([{}])).toEqual([]);
  });
});
