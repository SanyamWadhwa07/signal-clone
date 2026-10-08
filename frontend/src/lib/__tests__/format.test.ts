import { describe, expect, it } from "vitest";

import {
  formatCountdown,
  formatDayLabel,
  formatDuration,
  formatFileSize,
  formatListTime,
  formatMessageTime,
  formatPresence,
} from "@/lib/format";

const now = new Date(2026, 9, 8, 15, 30); // Thu 8 Oct 2026, 3:30 PM local
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

describe("formatListTime", () => {
  it("shows Now and minutes for fresh messages", () => {
    expect(formatListTime(new Date(now.getTime() - 20_000).toISOString(), now)).toBe("Now");
    expect(formatListTime(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe("5m");
  });
  it("shows the clock time earlier today", () => {
    expect(formatListTime(at(2026, 9, 8, 9, 5), now)).toBe("9:05 AM");
  });
  it("shows a weekday within the last week, then dates", () => {
    expect(formatListTime(at(2026, 9, 6), now)).toBe("Tue");
    expect(formatListTime(at(2026, 8, 20), now)).toBe("Sep 20");
    expect(formatListTime(at(2025, 11, 31), now)).toBe("Dec 31, 2025");
  });
});

describe("formatMessageTime", () => {
  it("is short and relative for the first hour, then the clock time", () => {
    expect(formatMessageTime(new Date(now.getTime() - 5_000).toISOString(), now)).toBe("Now");
    expect(formatMessageTime(new Date(now.getTime() - 30 * 60_000).toISOString(), now)).toBe("30m");
    expect(formatMessageTime(at(2026, 9, 8, 9, 5), now)).toBe("9:05 AM");
  });
});

describe("formatDayLabel", () => {
  it("labels today, yesterday, weekdays and dates", () => {
    expect(formatDayLabel(at(2026, 9, 8), now)).toBe("Today");
    expect(formatDayLabel(at(2026, 9, 7), now)).toBe("Yesterday");
    expect(formatDayLabel(at(2026, 9, 5), now)).toBe("Monday");
    expect(formatDayLabel(at(2026, 8, 20), now)).toBe("September 20");
    expect(formatDayLabel(at(2025, 0, 2), now)).toBe("January 2, 2025");
  });
});

describe("formatPresence", () => {
  it("covers online, recent and older last-seen", () => {
    expect(formatPresence(true, null, now)).toBe("Online");
    expect(formatPresence(false, null, now)).toBe("Offline");
    expect(formatPresence(false, new Date(now.getTime() - 10_000).toISOString(), now)).toBe(
      "Last seen just now",
    );
    expect(formatPresence(false, new Date(now.getTime() - 12 * 60_000).toISOString(), now)).toBe(
      "Last seen 12 min ago",
    );
    expect(formatPresence(false, at(2026, 9, 8, 9, 0), now)).toBe("Last seen today at 9:00 AM");
    expect(formatPresence(false, at(2026, 9, 7, 22, 15), now)).toBe(
      "Last seen yesterday at 10:15 PM",
    );
  });
});

describe("formatDuration", () => {
  it("names Signal's disappearing-message presets", () => {
    expect(formatDuration(30)).toBe("30 seconds");
    expect(formatDuration(300)).toBe("5 minutes");
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(8 * 3600)).toBe("8 hours");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(7 * 86400)).toBe("1 week");
    expect(formatDuration(28 * 86400)).toBe("4 weeks");
  });
});

describe("formatCountdown / formatFileSize", () => {
  it("compacts remaining time", () => {
    expect(formatCountdown(45_000)).toBe("45s");
    expect(formatCountdown(4 * 60_000)).toBe("4m");
    expect(formatCountdown(3 * 3600_000)).toBe("3h");
    expect(formatCountdown(-5)).toBe("0s");
  });
  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
