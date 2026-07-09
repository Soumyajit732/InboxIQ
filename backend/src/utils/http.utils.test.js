import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './http.utils.js';

const errorWithStatus = (status) => {
  const err = new Error(`status ${status}`);
  err.response = { status };
  return err;
};

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { retries: 3, delayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a 502 and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(errorWithStatus(502))
      .mockRejectedValueOnce(errorWithStatus(502))
      .mockResolvedValueOnce('recovered');
    await expect(withRetry(fn, { retries: 3, delayMs: 1 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on connection errors with no response (status undefined)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, { retries: 1, delayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(errorWithStatus(502));
    await expect(withRetry(fn, { retries: 2, delayMs: 1 })).rejects.toThrow('status 502');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors (e.g. 400)', async () => {
    const fn = vi.fn().mockRejectedValue(errorWithStatus(400));
    await expect(withRetry(fn, { retries: 3, delayMs: 1 })).rejects.toThrow('status 400');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
