// Measures extraction quality against a hand-labeled golden dataset. Calls the real
// OpenAI API (costs money, isn't deterministic) -- run manually via `npm run eval`,
// not part of the test suite or CI.
import { analyzeEmailThread } from '../src/services/nlp.service.js';
import { EVAL_CASES } from './dataset.js';

function taskMatchesKeywords(taskText, keywords) {
  if (!keywords?.length) return true;
  const lower = (taskText || '').toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

async function runCase(testCase) {
  const result = await analyzeEmailThread(testCase.messages);
  const { expected } = testCase;
  const checks = [];

  const gotTask = result.task !== null;
  checks.push({
    name: 'task-detection',
    pass: gotTask === expected.expectTask,
    detail: `expected task=${expected.expectTask}, got task=${gotTask} ("${result.task}")`,
  });

  if (expected.expectDeadline !== undefined) {
    const gotDeadline = result.deadline !== null;
    checks.push({
      name: 'deadline-presence',
      pass: gotDeadline === expected.expectDeadline,
      detail: `expected deadline=${expected.expectDeadline}, got deadline=${result.deadline}`,
    });
  }

  if (expected.taskKeywords) {
    checks.push({
      name: 'task-content',
      pass: taskMatchesKeywords(result.task, expected.taskKeywords),
      detail: `task="${result.task}" expected to mention one of [${expected.taskKeywords.join(', ')}]`,
    });
  }

  if (expected.minPriority !== undefined || expected.maxPriority !== undefined) {
    const min = expected.minPriority ?? 1;
    const max = expected.maxPriority ?? 5;
    checks.push({
      name: 'priority-range',
      pass: result.priority >= min && result.priority <= max,
      detail: `expected priority ${min}-${max}, got ${result.priority}`,
    });
  }

  return { id: testCase.id, result, checks, allPass: checks.every(c => c.pass) };
}

async function main() {
  console.log(`Running eval on ${EVAL_CASES.length} cases against the real OpenAI API...\n`);

  const outcomes = [];
  for (const testCase of EVAL_CASES) {
    const outcome = await runCase(testCase);
    outcomes.push(outcome);
    console.log(`${outcome.allPass ? '✓' : '✗'} ${outcome.id}`);
    for (const check of outcome.checks) {
      if (!check.pass) console.log(`    FAIL [${check.name}]: ${check.detail}`);
    }
  }

  const byCheck = {};
  for (const outcome of outcomes) {
    for (const check of outcome.checks) {
      byCheck[check.name] ??= { pass: 0, total: 0 };
      byCheck[check.name].total++;
      if (check.pass) byCheck[check.name].pass++;
    }
  }

  console.log('\n--- Summary ---');
  for (const [name, { pass, total }] of Object.entries(byCheck)) {
    console.log(`${name}: ${pass}/${total} (${Math.round((pass / total) * 100)}%)`);
  }

  const overallPass = outcomes.filter(o => o.allPass).length;
  console.log(`\nOverall: ${overallPass}/${outcomes.length} cases fully passed (${Math.round((overallPass / outcomes.length) * 100)}%)`);

  if (overallPass !== outcomes.length) process.exitCode = 1;
}

main().catch(err => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
