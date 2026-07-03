export function sortByPriority(results) {
  return [...results].sort((a, b) => (b.priority || 1) - (a.priority || 1));
}

export function filterLowConfidence(results, threshold = 0.4) {
  return results.filter(r => (r.confidence || 0) >= threshold);
}
