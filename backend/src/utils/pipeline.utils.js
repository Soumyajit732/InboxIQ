export function deduplicateTasks(results) {
  const seen = new Set();
  return results.filter(r => {
    if (!r.task) return false;
    const key = r.task.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortByPriority(results) {
  return [...results].sort((a, b) => (b.priority || 1) - (a.priority || 1));
}

export function filterLowConfidence(results, threshold = 0.4) {
  return results.filter(r => (r.confidence || 0) >= threshold);
}
