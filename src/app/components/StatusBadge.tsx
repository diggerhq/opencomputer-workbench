// The badge: the dot and the label from the one vocabulary, in the tone's
// tokens. Inline in a row (no background), full on the task page. The
// display state comes from lib/display, the one derivation from the three
// facets, so the row, the badge and the task page agree.
import { cn } from "@/lib/utils";
import { DISPLAY, type DisplayState, type Tone, workingLabel } from "@/vocabulary";

/** Tailwind names for each tone; static strings so the classes exist in the build. */
const TONES: Record<Tone, { text: string; bg: string; dot: string }> = {
  "status-starting": { text: "text-status-starting", bg: "bg-status-starting-bg", dot: "bg-status-starting-dot" },
  "status-not-started": {
    text: "text-status-not-started",
    bg: "bg-status-not-started-bg",
    dot: "bg-status-not-started-dot",
  },
  "status-queued": { text: "text-status-queued", bg: "bg-status-queued-bg", dot: "bg-status-queued-dot" },
  "status-working": { text: "text-status-working", bg: "bg-status-working-bg", dot: "bg-status-working-dot" },
  "status-stopping": { text: "text-status-stopping", bg: "bg-status-stopping-bg", dot: "bg-status-stopping-dot" },
  "status-idle": { text: "text-status-idle", bg: "bg-status-idle-bg", dot: "bg-status-idle-dot" },
  "status-ready-for-review": {
    text: "text-status-ready-for-review",
    bg: "bg-status-ready-for-review-bg",
    dot: "bg-status-ready-for-review-dot",
  },
  "status-failed": { text: "text-status-failed", bg: "bg-status-failed-bg", dot: "bg-status-failed-dot" },
  "status-archived": { text: "text-status-archived", bg: "bg-status-archived-bg", dot: "bg-status-archived-dot" },
  "status-ended": { text: "text-status-ended", bg: "bg-status-ended-bg", dot: "bg-status-ended-dot" },
};

export { displayStateOf, needsAttention } from "@/lib/display";

export function StatusBadge({
  state,
  queued = 0,
  variant = "inline",
  className,
}: {
  state: DisplayState;
  queued?: number;
  variant?: "inline" | "full";
  className?: string;
}) {
  const entry = DISPLAY[state];
  const tone = TONES[entry.tone];
  const label = state === "working" ? workingLabel(queued) : entry.label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium",
        tone.text,
        variant === "full" && cn("h-6 rounded-full px-2.5", tone.bg),
        className,
      )}
      title={entry.description}
    >
      {entry.dot !== "none" ? (
        <span
          aria-hidden="true"
          className={cn("size-dot shrink-0 rounded-full", tone.dot, entry.dot === "pulse" && "status-dot-pulse")}
        />
      ) : variant === "inline" ? (
        // Archived and Ended have no dot; in a row the space is kept so every label starts on the same edge.
        <span aria-hidden="true" className="size-dot shrink-0" />
      ) : null}
      {label}
    </span>
  );
}
