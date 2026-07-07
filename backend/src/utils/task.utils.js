export const VALID_STATUSES = ['open', 'done', 'snoozed', 'dismissed', 'archived'];

export function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

// A snoozed task becomes actionable again once its snooze window passes -- computed
// here at read time rather than via a background job flipping the stored status.
export function effectiveStatus(status, snoozedUntil, now = new Date()) {
  if (status === 'snoozed' && snoozedUntil && new Date(snoozedUntil) <= now) {
    return 'open';
  }
  return status;
}
