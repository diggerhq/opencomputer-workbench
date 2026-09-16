// The submission envelope and what happens to it: identity belongs to a
// submission, never to a page's view of the world. The composer mints the
// task id and holds `{ taskId, deploymentId, repo, ref, text }` until the
// first turn's admission receipt arrives, a duplicate receipt included. A
// lost reply is retried with the same envelope; a conflict or a refusal
// keeps the draft with the problem shown. Pure and unit-tested; the Composer
// only drives it.
import type { Task } from "../../server/task";
import type { ApiError } from "./api";
import { ulid } from "./ulid";

export interface Envelope {
  readonly taskId: string;
  readonly deploymentId: string;
  readonly repo: string;
  readonly ref: string;
  readonly text: string;
}

export interface Receipt {
  readonly turnId: string;
  readonly status: "queued" | "running";
  readonly duplicate: boolean;
}

export interface Problem {
  readonly code: string;
  readonly message: string;
  /** A lost reply or an upstream outage: the same envelope is sent again. */
  readonly retryable: boolean;
}

export type Submission =
  | { readonly status: "idle" }
  | { readonly status: "submitting"; readonly envelope: Envelope; readonly attempt: number }
  | { readonly status: "failed"; readonly envelope: Envelope; readonly attempt: number; readonly problem: Problem }
  | { readonly status: "done"; readonly envelope: Envelope; readonly task: Task; readonly receipt: Receipt };

export const IDLE: Submission = { status: "idle" };

/** Retries a lost reply this many times before showing the problem. */
export const AUTOMATIC_RETRIES = 2;

export function compose(
  fields: { repo: string; ref: string; text: string },
  deploymentId: string,
  taskId: string = ulid(),
): Envelope {
  return { taskId, deploymentId, repo: fields.repo, ref: fields.ref.trim(), text: fields.text.trim() };
}

export function begin(envelope: Envelope): Submission {
  return { status: "submitting", envelope, attempt: 1 };
}

/** The same envelope, one more attempt; only a failed submission can retry. */
export function retry(state: Submission): Submission {
  if (state.status !== "failed" && state.status !== "submitting") return state;
  return { status: "submitting", envelope: state.envelope, attempt: state.attempt + 1 };
}

export function succeed(state: Submission, outcome: { task: Task; receipt: Receipt }): Submission {
  if (state.status !== "submitting") return state;
  return { status: "done", envelope: state.envelope, task: outcome.task, receipt: outcome.receipt };
}

export function fail(state: Submission, cause: unknown): Submission {
  if (state.status !== "submitting") return state;
  return { status: "failed", envelope: state.envelope, attempt: state.attempt, problem: problemOf(cause) };
}

/** Whether a failed submission should be sent again without asking. */
export function shouldRetry(state: Submission): boolean {
  return state.status === "failed" && state.problem.retryable && state.attempt <= AUTOMATIC_RETRIES;
}

export function problemOf(cause: unknown): Problem {
  const error = cause as Partial<ApiError> | undefined;
  if (error && typeof error.status === "number" && typeof error.code === "string") {
    return {
      code: error.code,
      message: error.message ?? error.code,
      // 5xx is an outage upstream; 4xx is an answer about this envelope.
      retryable: error.status >= 500,
    };
  }
  return {
    code: "network_error",
    message: cause instanceof Error ? cause.message : "The request was not answered.",
    retryable: true,
  };
}
