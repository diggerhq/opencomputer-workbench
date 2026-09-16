// The product's fixed vocabulary: the display state a task's three facets
// derive to, the words that state is shown with, the tone each one takes
// from src/tokens.css, and the copy a public failure code turns into. The
// badge, the row and the task page read this one definition; nothing else
// derives a state or spells a failure.
import type { Execution, Task } from "@/shared/task";

/**
 * What the badge can show. `ready_for_review` is idle with a result from the
 * last settled turn at the changes or published stage; `archived` is the
 * label, shown when the list is filtered to archived tasks.
 */
export type DisplayState = Execution | "ready_for_review" | "archived";

/** Archived is the label; ready for review is idle with a fresh result at changes or published. */
export function displayStateOf(task: Task): DisplayState {
  if (task.archived) return "archived";
  if (
    task.execution === "idle" &&
    task.result?.fromLastTurn &&
    (task.result.stage === "changes" || task.result.stage === "published")
  ) {
    return "ready_for_review";
  }
  return task.execution;
}

/** Facts that are the same for every member: a failed turn or a request that was never accepted. */
export function needsAttention(task: Task): boolean {
  return task.execution === "failed" || task.execution === "not_started";
}

/** The token stem in src/tokens.css: `--status-<tone>`, `-bg`, `-dot`. */
export type Tone =
  | "status-starting"
  | "status-not-started"
  | "status-queued"
  | "status-working"
  | "status-stopping"
  | "status-idle"
  | "status-ready-for-review"
  | "status-failed"
  | "status-archived"
  | "status-ended";

export interface DisplayEntry {
  /** The word on the badge, exactly as the design fixes it. */
  readonly label: string;
  readonly tone: Tone;
  /** Working is the only pulsing dot; Archived and Ended have none. */
  readonly dot: "pulse" | "solid" | "none";
  /** One sentence for the hover title and the empty-state copy. */
  readonly description: string;
}

export const DISPLAY: Record<DisplayState, DisplayEntry> = {
  starting: {
    label: "Starting",
    tone: "status-starting",
    dot: "solid",
    description: "The task exists and its first turn has not been admitted yet.",
  },
  not_started: {
    label: "Not started",
    tone: "status-not-started",
    dot: "solid",
    description: "The request was never accepted as work. Retry the submission or archive the task.",
  },
  queued: {
    label: "Queued",
    tone: "status-queued",
    dot: "solid",
    description: "A turn is admitted and waiting to run.",
  },
  working: {
    label: "Working",
    tone: "status-working",
    dot: "pulse",
    description: "The agent is running a turn.",
  },
  stopping: {
    label: "Stopping",
    tone: "status-stopping",
    dot: "solid",
    description: "A stop was recorded and the turn is settling.",
  },
  idle: {
    label: "Idle",
    tone: "status-idle",
    dot: "solid",
    description: "The last turn settled and nothing is queued.",
  },
  ready_for_review: {
    label: "Ready for review",
    tone: "status-ready-for-review",
    dot: "solid",
    description: "The last turn reported a tested commit or a pull request.",
  },
  failed: {
    label: "Failed",
    tone: "status-failed",
    dot: "solid",
    description: "The last turn failed. A follow-up clears it.",
  },
  archived: {
    label: "Archived",
    tone: "status-archived",
    dot: "none",
    description: "Hidden from the list; the task can still be opened.",
  },
  ended: {
    label: "Ended",
    tone: "status-ended",
    dot: "none",
    description: "The session ended. The task is read-only.",
  },
};

/** Working with queued turns: "Working, 2 queued". */
export function workingLabel(queued: number): string {
  return queued > 0 ? `${DISPLAY.working.label}, ${String(queued)} queued` : DISPLAY.working.label;
}

/**
 * Copy for the public failure codes the platform emits on a turn or refuses
 * at admission. Anything not listed is shown with its code.
 */
export const FAILURE_COPY: Record<string, string> = {
  runtime_lost:
    "The agent's runtime stopped responding and this turn was abandoned. Send a follow-up to continue; it may need a fresh computer.",
  runtime_failed: "The agent's runtime failed before the turn finished. Send a follow-up to continue.",
  sandbox_failed:
    "The task's computer could not run this turn. Send a follow-up to continue; it may need a fresh computer.",
  model_rejected:
    "The model provider rejected the request. Check the account's credentials, rate limit or quota, then send a follow-up.",
  insufficient_credits: "The workspace is out of credits. Add credits before starting or continuing a task.",
  model_stream_failed:
    "The model call failed twice in a row and the turn stopped. Send a follow-up to continue where it left off.",
  context_too_long:
    "This conversation exceeds the model's context window. Start a fresh task and name this one as its predecessor.",
  interrupted: "The turn was stopped before it finished.",
  session_ended: "The session ended while the turn ran.",
  deployment_invalid: "The agent's deployment could not be loaded. Redeploy the worker, then start a fresh task.",
  model_unavailable: "The requested model is not available to this agent. Check the model in the agent's code.",
  sandbox_timeout: "A command on the task's computer did not finish in time. Send a follow-up to continue.",
  tool_failed: "A tool failed while the agent worked. Send a follow-up to continue.",
  agent_failed: "The agent failed. Send a follow-up to continue.",
};

export function failureCopy(code: string): string {
  return FAILURE_COPY[code] ?? `The turn failed with code ${code}.`;
}
