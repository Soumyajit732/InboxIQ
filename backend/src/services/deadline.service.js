import * as chrono from 'chrono-node';

export function extractDeadline(text, referenceDate = new Date()) {
  const results = chrono.parse(text, referenceDate, { forwardDate: true });
  if (!results.length) return null;

  const result = results[0];
  const date = result.start.date();
  if (!result.start.isCertain('hour')) {
    date.setHours(17, 0, 0, 0);
  }
  return date;
}

export function analyzeWithChrono(text) {
  const results = chrono.parse(text, new Date(), { forwardDate: true });
  const result = results[0] || null;

  let deadline = null;
  if (result) {
    deadline = result.start.date();
    if (!result.start.isCertain('hour')) {
      deadline.setHours(17, 0, 0, 0);
    }
  }

  return {
    task: 'Derived from conversation',
    deadline: deadline ? deadline.toISOString() : null,
    priority: 2,
    summary: text.slice(0, 100),
    confidence: 0.5,
    source_snippet: result ? result.text : null,
    reasoning: result
      ? `Deadline parsed from "${result.text}" via chrono-node (LLM extraction was unavailable).`
      : null,
    deadline_source: deadline ? 'chrono' : null,
  };
}
