// Relative timestamps for rows and headers ("4 min ago", "yesterday") with
// the absolute time kept for the hover title. Days are calendar days in the
// reader's zone, so late last night reads "yesterday", not "22 h ago".
// Pure, so the same words render in tests and in the browser.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const age = Math.max(0, now - then);
  if (age < MINUTE) return "just now";
  if (age < HOUR) return `${String(Math.floor(age / MINUTE))} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (days <= 0) return `${String(Math.floor(age / HOUR))} h ago`;
  if (days === 1) return "yesterday";
  if (days < 30) return `${String(days)} days ago`;
  return new Date(then).toISOString().slice(0, 10);
}

/** The absolute time for a title attribute: the ISO instant. */
export function absoluteTime(iso: string): string {
  const then = Date.parse(iso);
  return Number.isNaN(then) ? iso : new Date(then).toISOString();
}
