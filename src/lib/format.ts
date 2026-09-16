// Pure formatters for what the task page shows: relative ages with the
// absolute time beside them, command durations and short commit shas.
// Nothing here reads the clock; callers pass `now` so tests are exact.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "4 min ago", "1 h ago", "yesterday", "3 days ago", then the date. */
export function formatRelative(iso: string | undefined, now: number): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const elapsed = Math.max(0, now - then);
  if (elapsed < 45_000) return "just now";
  if (elapsed < 90_000) return "1 min ago";
  if (elapsed < 45 * MINUTE) return `${String(Math.round(elapsed / MINUTE))} min ago`;
  if (elapsed < 90 * MINUTE) return "1 h ago";
  if (elapsed < 24 * HOUR) return `${String(Math.round(elapsed / HOUR))} h ago`;
  if (elapsed < 36 * HOUR) return "yesterday";
  if (elapsed < 30 * DAY) return `${String(Math.round(elapsed / DAY))} days ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "0.9 s", "6.1 s", "38 s", "2 min 3 s". */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms) || ms < 0) return "";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < MINUTE) return `${String(Math.round(ms / 1000))} s`;
  const minutes = Math.floor(ms / MINUTE);
  const seconds = Math.round((ms - minutes * MINUTE) / 1000);
  return seconds ? `${String(minutes)} min ${String(seconds)} s` : `${String(minutes)} min`;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/** The first line of a request, the title the design derives from it. */
export function firstLine(text: string): string {
  return text.split("\n", 1)[0]?.trim() ?? "";
}
