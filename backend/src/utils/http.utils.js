export async function withRetry(fn, { retries = 3, delayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const isRetryable = !status || status === 502 || status === 503;
      if (!isRetryable || attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
