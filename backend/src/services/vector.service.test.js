import { describe, it, expect, vi } from 'vitest';

// storeEmail/searchEmails call the real OpenAI embeddings API -- stub it so the
// store/search/isolation tests below exercise our own SQL logic, not a live network call.
vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = {
      create: async ({ input }) => ({
        data: [{ embedding: fakeEmbedding(input) }],
      }),
    };
  },
}));

function fakeEmbedding(text) {
  // Deterministic 4-dim "embedding" derived from character codes -- good enough to prove
  // storage/retrieval and isolation behavior without needing real semantic similarity.
  const vec = [0, 0, 0, 0];
  for (let i = 0; i < text.length; i++) {
    vec[i % 4] += text.charCodeAt(i);
  }
  return vec;
}

const { cosineSimilarity, storeEmail, searchEmails } = await import('./vector.service.js');

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it('is scale-invariant', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});

describe('storeEmail / searchEmails user isolation', () => {
  it('only returns a user\'s own tasks, even when another user has a task under the same thread_id', async () => {
    await storeEmail({
      user_email: 'alice@example.com',
      thread_id: 'shared-thread-id',
      email_text: 'Submit the Q3 report',
      task: 'Submit the Q3 report',
      deadline: null,
      priority: 5,
      summary: "Alice's task",
      confidence: 1,
    });

    await storeEmail({
      user_email: 'bob@example.com',
      thread_id: 'shared-thread-id',
      email_text: 'Submit the Q3 report',
      task: 'Submit the Q3 report',
      deadline: null,
      priority: 5,
      summary: "Bob's task",
      confidence: 1,
    });

    const aliceResults = await searchEmails('alice@example.com', 'report', 5);
    const bobResults = await searchEmails('bob@example.com', 'report', 5);
    const strangerResults = await searchEmails('stranger@example.com', 'report', 5);

    expect(aliceResults).toHaveLength(1);
    expect(aliceResults[0].summary).toBe("Alice's task");

    expect(bobResults).toHaveLength(1);
    expect(bobResults[0].summary).toBe("Bob's task");

    expect(strangerResults).toEqual([]);
  });

  it('lets two different users independently store a task under the same thread_id without clobbering each other', async () => {
    await storeEmail({
      user_email: 'carol@example.com',
      thread_id: 'another-shared-id',
      email_text: 'x',
      task: 'Carol task',
      deadline: null,
      priority: 1,
      summary: 'carol',
      confidence: 1,
    });
    await storeEmail({
      user_email: 'dave@example.com',
      thread_id: 'another-shared-id',
      email_text: 'x',
      task: 'Dave task',
      deadline: null,
      priority: 1,
      summary: 'dave',
      confidence: 1,
    });

    const carolResults = await searchEmails('carol@example.com', 'x', 5);
    const daveResults = await searchEmails('dave@example.com', 'x', 5);

    expect(carolResults.map(r => r.task)).toEqual(['Carol task']);
    expect(daveResults.map(r => r.task)).toEqual(['Dave task']);
  });
});
