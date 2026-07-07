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

const { cosineSimilarity, storeEmail, searchEmails, getTasksForUser, updateTaskStatus } = await import('./vector.service.js');

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

describe('storeEmail rescan preserves task status', () => {
  it('does not reset a user-set status back to open when the same thread is re-stored', async () => {
    const email = 'erin@example.com';
    const thread_id = 'rescan-thread';

    await storeEmail({
      user_email: email,
      thread_id,
      email_text: 'Submit the report',
      task: 'Submit the report',
      deadline: null,
      priority: 3,
      summary: 'v1',
      confidence: 1,
    });

    expect(updateTaskStatus(email, thread_id, 'done')).toBe(true);
    expect(getTasksForUser(email).find(t => t.thread_id === thread_id).status).toBe('done');

    // Simulate a rescan of the same thread turning up a slightly different extraction
    await storeEmail({
      user_email: email,
      thread_id,
      email_text: 'Submit the report (reply added)',
      task: 'Submit the report',
      deadline: '2026-08-01T17:00:00',
      priority: 4,
      summary: 'v2 -- updated after a new reply',
      confidence: 1,
    });

    const task = getTasksForUser(email).find(t => t.thread_id === thread_id);
    expect(task.status).toBe('done'); // preserved, not reset to 'open'
    expect(task.summary).toBe('v2 -- updated after a new reply'); // extraction data still refreshes
  });
});

describe('searchEmails hybrid filters', () => {
  const email = 'frank@example.com';

  const seed = async () => {
    await storeEmail({
      user_email: email,
      thread_id: 'filter-thread-budget',
      email_text: 'Submit the budget report',
      task: 'Submit budget report',
      deadline: '2026-07-01T17:00:00',
      priority: 5,
      summary: 'budget report, high priority, due early July',
      confidence: 1,
      sender: 'Alice <alice@corp.com>',
    });
    await storeEmail({
      user_email: email,
      thread_id: 'filter-thread-interview',
      email_text: 'Schedule an interview',
      task: 'Schedule interview',
      deadline: '2026-08-15T09:00:00',
      priority: 2,
      summary: 'low priority interview scheduling, due mid August',
      confidence: 1,
      sender: 'Bob Recruiter <bob@recruiting.com>',
    });
    await storeEmail({
      user_email: email,
      thread_id: 'filter-thread-review',
      email_text: 'Review the budget report',
      task: 'Review budget report',
      deadline: null,
      priority: 4,
      summary: 'review task, no deadline set',
      confidence: 1,
      sender: 'Carol <carol@corp.com>',
    });
    updateTaskStatus(email, 'filter-thread-review', 'done');
  };

  it('filters by priorityMin', async () => {
    await seed();
    const results = await searchEmails(email, 'report', 10, { priorityMin: 4 });
    expect(results.map(r => r.thread_id).sort()).toEqual(['filter-thread-budget', 'filter-thread-review']);
  });

  it('filters by before/after deadline range, excluding tasks with no deadline', async () => {
    await seed();
    const before = await searchEmails(email, 'x', 10, { before: '2026-07-15T00:00:00' });
    expect(before.map(r => r.thread_id)).toEqual(['filter-thread-budget']);

    const after = await searchEmails(email, 'x', 10, { after: '2026-08-01T00:00:00' });
    expect(after.map(r => r.thread_id)).toEqual(['filter-thread-interview']);
  });

  it('filters by sender substring match', async () => {
    await seed();
    const results = await searchEmails(email, 'x', 10, { sender: 'recruit' });
    expect(results.map(r => r.thread_id)).toEqual(['filter-thread-interview']);
  });

  it('filters by status', async () => {
    await seed();
    const results = await searchEmails(email, 'x', 10, { status: 'done' });
    expect(results.map(r => r.thread_id)).toEqual(['filter-thread-review']);
  });

  it('combines multiple filters with AND semantics', async () => {
    await seed();
    const results = await searchEmails(email, 'x', 10, { priorityMin: 4, status: 'open' });
    expect(results.map(r => r.thread_id)).toEqual(['filter-thread-budget']);
  });

  it('returns everything for this user when no filters are given', async () => {
    await seed();
    const results = await searchEmails(email, 'x', 10);
    expect(results.map(r => r.thread_id).sort()).toEqual([
      'filter-thread-budget', 'filter-thread-interview', 'filter-thread-review',
    ]);
  });
});
