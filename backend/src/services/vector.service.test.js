import { describe, it, expect, vi } from 'vitest';

// storeEmail/searchEmails now delegate to the Python service (embeddings + Chroma) over
// HTTP instead of calling OpenAI directly. This simulates that service in-memory,
// replicating its actual filtering contract (user scoping, priority_min, before/after,
// sender substring) so these tests exercise real behavior, not just "did Node call axios."
const fakeVectorStore = new Map();

vi.mock('axios', () => ({
  default: {
    post: vi.fn(async (url, body) => {
      if (url.endsWith('/vector/store')) {
        fakeVectorStore.set(`${body.user_email}::${body.thread_id}`, body);
        return { data: { status: 'stored' } };
      }
      throw new Error(`Unexpected POST ${url}`);
    }),
    get: vi.fn(async (url, config) => {
      if (url.endsWith('/vector/search')) {
        const { user_email, priority_min, before, after, sender } = config.params;
        const results = [...fakeVectorStore.values()]
          .filter(v => v.user_email === user_email)
          .filter(v => priority_min == null || v.priority >= priority_min)
          .filter(v => before == null || (v.deadline && v.deadline <= before))
          .filter(v => after == null || (v.deadline && v.deadline >= after))
          .filter(v => !sender || (v.sender || '').toLowerCase().includes(String(sender).toLowerCase()))
          // Stable fake ranking -- real ranking is Python/Chroma's job, not under test here.
          .map((v, i) => ({ thread_id: v.thread_id, relevance_score: 1 - i * 0.01 }));
        return { data: { query: config.params.q, results } };
      }
      throw new Error(`Unexpected GET ${url}`);
    }),
  },
}));

const { storeEmail, searchEmails, getTasksForUser, updateTaskStatus } = await import('./vector.service.js');

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
