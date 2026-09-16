// The display state of a task, derived from its three facets and nowhere
// else, so the row, the badge and the task page agree. Pure and tested over
// the row fixtures.
import type { Task } from "../server/task";
import type { DisplayState } from "./vocabulary";

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
