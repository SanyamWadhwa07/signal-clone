/** Date/time and size formatting. All functions take `now` so they are deterministic in tests. */

const LOCALE = "en-US";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const monthDay = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const longMonthDay = new Intl.DateTimeFormat(LOCALE, { month: "long", day: "numeric" });
const longMonthDayYear = new Intl.DateTimeFormat(LOCALE, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days between two instants in local time (0 = same day, 1 = yesterday...). */
export function calendarDaysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

/** "10:42 AM" */
export function formatClock(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Timestamp inside a bubble, short like Signal's: Now · 30m · 10:42 AM */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "Now";
  if (elapsed < 60 * MINUTE) return `${Math.floor(elapsed / MINUTE)}m`;
  return timeFormat.format(date);
}

/** Conversation-list timestamp: Now · 5m · 10:42 AM · Mon · Oct 2 · Oct 2, 2025 */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "Now";
  if (elapsed < 60 * MINUTE) return `${Math.floor(elapsed / MINUTE)}m`;
  const days = calendarDaysAgo(date, now);
  if (days === 0) return timeFormat.format(date);
  if (days < 7) return weekdayShort.format(date);
  return date.getFullYear() === now.getFullYear()
    ? monthDay.format(date)
    : monthDayYear.format(date);
}

/** Date divider inside a conversation: Today · Yesterday · Monday · October 2 */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = calendarDaysAgo(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return weekdayLong.format(date);
  return date.getFullYear() === now.getFullYear()
    ? longMonthDay.format(date)
    : longMonthDayYear.format(date);
}

/** Header subtitle for a person: "Online" · "Last seen 5 min ago" · "Last seen yesterday" */
export function formatPresence(
  online: boolean,
  lastSeenIso: string | null,
  now: Date = new Date(),
): string {
  if (online) return "Online";
  if (!lastSeenIso) return "Offline";
  const date = new Date(lastSeenIso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "Last seen just now";
  if (elapsed < 60 * MINUTE) return `Last seen ${Math.floor(elapsed / MINUTE)} min ago`;
  const days = calendarDaysAgo(date, now);
  if (days === 0) return `Last seen today at ${timeFormat.format(date)}`;
  if (days === 1) return `Last seen yesterday at ${timeFormat.format(date)}`;
  if (days < 7) return `Last seen ${weekdayLong.format(date)}`;
  return `Last seen ${monthDay.format(date)}`;
}

const DURATION_UNITS: [number, string][] = [
  [7 * 86400, "week"],
  [86400, "day"],
  [3600, "hour"],
  [60, "minute"],
  [1, "second"],
];

/** 30 → "30 seconds", 3600 → "1 hour", 604800 → "1 week", 2419200 → "4 weeks" */
export function formatDuration(seconds: number): string {
  for (const [unitSeconds, name] of DURATION_UNITS) {
    if (seconds >= unitSeconds && seconds % unitSeconds === 0) {
      const count = seconds / unitSeconds;
      return `${count} ${name}${count === 1 ? "" : "s"}`;
    }
  }
  return `${seconds} seconds`;
}

/** Compact countdown for the disappearing-message badge: 59s · 4m · 7h · 6d */
export function formatCountdown(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}h`;
  return `${Math.ceil(seconds / 86400)}d`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
