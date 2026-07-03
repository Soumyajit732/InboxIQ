export function computePriority(task, deadline, sender) {
  let score = 0;
  const urgentWords = ['urgent', 'asap', 'important', 'deadline'];

  if (urgentWords.some(w => (task || '').toLowerCase().includes(w))) score += 5;
  if (deadline) score += 3;
  if ((sender || '').toLowerCase().includes('professor')) score += 2;

  return score;
}
