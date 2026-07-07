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
  const deadline = extractDeadline(text);
  return {
    task: 'Derived from conversation',
    deadline: deadline ? deadline.toISOString() : null,
    priority: 2,
    summary: text.slice(0, 100),
    confidence: 0.5,
  };
}
