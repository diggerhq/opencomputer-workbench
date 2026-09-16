// A task as both sides of the app know it: the projection the server
// computes from a session and the browser renders. Only types and pure
// values live here; `toTask` and the label writes are the server's.
import type { TaskResult } from "./report";

/** The execution facet: what the session is doing, projected from its status and activity. */
export type Execution = "starting" | "not_started" | "queued" | "working" | "stopping" | "idle" | "failed" | "ended";

export interface Task {
  /** The session id: the URL and the app's identity after creation. */
  readonly id: string;
  readonly execution: Execution;
  /** Turns admitted and waiting behind the running one. */
  readonly queued: number;
  /** The public failure code of the last failed turn, when the row carries it. */
  readonly failure?: { readonly code: string };
  readonly archived: boolean;
  readonly result?: TaskResult;
  readonly title: string;
  readonly repo: string;
  readonly ref: string;
  readonly actor: { readonly id: number; readonly login: string };
  /** The predecessor task, when this one continues another. */
  readonly continues?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The label keys the app writes; labels organize, they are neither authority nor proof. */
export const LABELS = Object.freeze({
  request: "request",
  title: "title",
  repo: "repo",
  ref: "ref",
  actorId: "actor_id",
  actorLogin: "actor_login",
  continues: "continues",
  archived: "archived",
});

/** The bounds on the label map, as the platform states them. */
export const LABEL_BOUNDS = Object.freeze({
  key: /^[a-z][a-z0-9_.-]{0,63}$/,
  valueLength: 256,
  keys: 16,
  bytes: 4096,
});
