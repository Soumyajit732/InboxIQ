// Golden-dataset eval cases for the extraction pipeline (analyzeEmailThread).
// Hand-labeled expectations, scored fuzzily (task-detection, deadline presence,
// keyword match, priority range) since exact-string matching against an LLM's
// output is too brittle to be a meaningful signal.
export const EVAL_CASES = [
  {
    id: 'clear-task-explicit-deadline',
    messages: ['Hi team, please submit the Q3 budget report by this Friday at 5pm. Important for the board meeting.'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['budget', 'report'], minPriority: 3 },
  },
  {
    id: 'clear-task-relative-tomorrow',
    messages: ['Can you send over the signed contract by tomorrow morning?'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['contract'] },
  },
  {
    id: 'no-task-casual-checkin',
    messages: ["Hey! Just wanted to check in, how's everything going? No rush on anything."],
    expected: { expectTask: false },
  },
  {
    id: 'promotional-email-ignored',
    messages: ["FLASH SALE! 50% off everything, ends tonight! Shop now before it's gone!"],
    expected: { expectTask: false },
  },
  {
    id: 'urgent-explicit-language',
    messages: ['URGENT: we need the signed NDA back ASAP, ideally within the hour. This is blocking the deal.'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['nda', 'sign'], minPriority: 4 },
  },
  {
    id: 'low-priority-no-rush',
    messages: ['Whenever you get a chance, could you take a look at the doc I shared? No rush at all, next few weeks is fine.'],
    expected: { expectTask: true, maxPriority: 3, taskKeywords: ['doc', 'look', 'review'] },
  },
  {
    id: 'meeting-schedule-request',
    messages: ['Are you free to hop on a call this Thursday at 2pm to discuss the roadmap?'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['call', 'roadmap', 'meeting'] },
  },
  {
    id: 'thread-latest-message-wins',
    messages: [
      'Can we push the report deadline to next week?',
      "Actually never mind, let's keep the original Friday deadline -- please finish the report by then.",
    ],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['report'] },
  },
  {
    id: 'system-notification-no-task',
    messages: ["Your password was successfully changed on July 5th. If this wasn't you, contact support."],
    expected: { expectTask: false },
  },
  {
    id: 'explicit-no-response-needed',
    messages: ['FYI, the office will be closed Monday for the holiday. No action needed.'],
    expected: { expectTask: false },
  },
  {
    id: 'vague-end-of-month-deadline',
    messages: ["We'll need the final numbers sometime before end of month."],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['numbers', 'final'] },
  },
  {
    id: 'short-terse-task',
    messages: ['Fix the login bug before EOD.'],
    expected: { expectTask: true, expectDeadline: true, minPriority: 3, taskKeywords: ['login', 'bug'] },
  },
  {
    id: 'confirm-receipt-request',
    messages: ["Please confirm you've received this document."],
    expected: { expectTask: true, taskKeywords: ['confirm'] },
  },
  {
    id: 'long-verbose-buried-task',
    messages: [
      'Hope you had a great weekend! Things have been pretty busy on our end, lots going on with the new office move ' +
      'and the team offsite planning. Anyway, one more thing -- could you review the attached proposal and get back ' +
      'to me by Wednesday? Thanks so much, talk soon.',
    ],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['proposal', 'review'] },
  },
  {
    id: 'newsletter-no-task',
    messages: ['This week in tech: 5 articles you should read. Click here to view the full roundup.'],
    expected: { expectTask: false },
  },
  {
    id: 'reminder-followup',
    messages: ['Just following up on my earlier email -- still waiting on the invoice from you, could you send it today?'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['invoice'] },
  },
  {
    id: 'high-priority-deadline-blocker',
    messages: ["The client is threatening to walk if we don't send the revised quote by end of day today. Please prioritize this."],
    expected: { expectTask: true, expectDeadline: true, minPriority: 4, taskKeywords: ['quote'] },
  },
  {
    id: 'calendar-invite-accept',
    messages: ['Please accept or decline this calendar invite for the all-hands meeting on Monday at 10am.'],
    expected: { expectTask: true, expectDeadline: true, taskKeywords: ['accept', 'invite', 'meeting'] },
  },
  {
    id: 'prize-scam-ignored',
    messages: ["You've won a prize! Click here to claim your reward before it expires."],
    expected: { expectTask: false },
  },
  {
    id: 'past-praise-not-a-new-task',
    messages: ['Thanks for finishing the report last Friday, great work!'],
    expected: { expectTask: false },
  },
];
