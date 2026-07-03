import { describe, it, expect } from "vitest";
import { getPriority, formatDeadline, initials, formatSyncTime } from "./format.js";

describe("getPriority", () => {
  it("buckets 4 and above as High", () => {
    expect(getPriority(4).label).toBe("High");
    expect(getPriority(5).label).toBe("High");
  });

  it("buckets exactly 3 as Medium", () => {
    expect(getPriority(3).label).toBe("Medium");
  });

  it("buckets anything else as Low", () => {
    expect(getPriority(1).label).toBe("Low");
    expect(getPriority(0).label).toBe("Low");
  });
});

describe("formatDeadline", () => {
  it("reports no deadline when none is given", () => {
    expect(formatDeadline(null)).toEqual({ date: "No deadline", countdown: null, urgency: "" });
  });

  it("marks a past deadline as expired", () => {
    const result = formatDeadline(new Date(Date.now() - 3600_000).toISOString());
    expect(result.countdown).toBe("Expired");
    expect(result.urgency).toBe("expired");
  });

  it("marks a deadline within 24h as urgent", () => {
    const result = formatDeadline(new Date(Date.now() + 2 * 3600_000).toISOString());
    expect(result.urgency).toBe("urgent");
    expect(result.countdown).toMatch(/h .*m left/);
  });

  it("marks a deadline beyond 24h as ok with a day count", () => {
    const result = formatDeadline(new Date(Date.now() + 50 * 3600_000).toISOString());
    expect(result.urgency).toBe("ok");
    expect(result.countdown).toMatch(/^\dd \dh left$/);
  });
});

describe("initials", () => {
  it("uppercases the first two characters of an email", () => {
    expect(initials("soumyajit732@gmail.com")).toBe("SO");
  });

  it("falls back to ? when no email is given", () => {
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});

describe("formatSyncTime", () => {
  it('reports "just now" for very recent timestamps', () => {
    expect(formatSyncTime(new Date().toISOString())).toBe("just now");
  });

  it("reports seconds ago for sub-minute timestamps", () => {
    expect(formatSyncTime(new Date(Date.now() - 30_000).toISOString())).toBe("30s ago");
  });

  it("reports minutes ago for sub-hour timestamps", () => {
    expect(formatSyncTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m ago");
  });
});
