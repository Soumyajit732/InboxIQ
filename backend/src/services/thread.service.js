import { analyzeEmailThread } from './nlp.service.js';
import { computePriority } from './priority.service.js';

function groupByThread(emails) {
  const threads = {};
  for (const email of emails) {
    const tid = email.thread_id || 'unknown_thread';
    if (!threads[tid]) threads[tid] = [];
    threads[tid].push(email);
  }
  return threads;
}

function combineThreadEmails(threadEmails) {
  return threadEmails
    .slice()
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    .map(e => (e.body || '').trim())
    .filter(Boolean)
    .join('\n');
}

export async function processAllThreads(emails) {
  const threads = groupByThread(emails);
  const results = [];

  for (const [threadId, threadEmails] of Object.entries(threads)) {
    const combinedText = combineThreadEmails(threadEmails);
    const extracted = await analyzeEmailThread([combinedText]);
    results.push({
      thread_id: threadId,
      combined_text: combinedText,
      task: extracted.task,
      deadline: extracted.deadline,
      priority: computePriority(combinedText, extracted.deadline, 'thread'),
    });
  }

  return results;
}
