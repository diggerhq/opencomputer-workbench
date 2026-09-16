// The only place OpenComputer facts become app facets. A task is one
// session; its three facets, execution, archived and result, are projected
// independently from the row (the design's Task lifecycle) and never stored.
// Pure: a row and a clock in, a task out; unit-tested over the row fixtures.
import { type Report, type ReportStage, reportSchema, reportStage } from "../lib/report";
import type { Session, SessionSummary, Turn } from "./client";

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
  readonly result?: Report & {
    readonly turnId: string;
    readonly reportedAt: string;
    readonly stage: ReportStage;
    /** Whether the reporting turn is the last settled one. */
    readonly fromLastTurn: boolean;
  };
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

/** The C1 bounds on the label map. */
export const LABEL_BOUNDS = Object.freeze({
  key: /^[a-z][a-z0-9_.-]{0,63}$/,
  valueLength: 256,
  keys: 16,
  bytes: 4096,
});

export class LabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabelError";
  }
}

/** Checks a label map against the C1 bounds; the map itself comes back unchanged. */
export function boundLabels<T extends Readonly<Record<string, string>>>(labels: T): T {
  const entries = Object.entries(labels);
  if (entries.length > LABEL_BOUNDS.keys) throw new LabelError(`At most ${String(LABEL_BOUNDS.keys)} labels`);
  for (const [key, value] of entries) {
    if (!LABEL_BOUNDS.key.test(key)) throw new LabelError(`Invalid label key ${JSON.stringify(key)}`);
    if (value.length > LABEL_BOUNDS.valueLength) {
      throw new LabelError(`Label ${key} is longer than ${String(LABEL_BOUNDS.valueLength)} characters`);
    }
  }
  if (new TextEncoder().encode(JSON.stringify(labels)).byteLength > LABEL_BOUNDS.bytes) {
    throw new LabelError(`Labels exceed ${String(LABEL_BOUNDS.bytes)} bytes`);
  }
  return labels;
}

/** The title of a request: its first non-empty line, within the label bound. */
export function titleOf(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  return (line ?? "Untitled task").slice(0, LABEL_BOUNDS.valueLength);
}

const NOT_STARTED_AFTER_MS = 2 * 60 * 1000;
const WORKING_STATUSES = new Set(["running", "waiting_runtime", "resuming"]);

const NO_ACTIVITY = Object.freeze({ activeTurnId: null, queued: 0, lastSettledTurn: null });

function execution(row: SessionSummary, now: number): { execution: Execution; failure?: { code: string } } {
  const { status } = row;
  const activity = row.activity ?? NO_ACTIVITY;
  if (status === "ended") return { execution: "ended" };
  if (status === "stopping") return { execution: "stopping" };
  if (status === "failed") return { execution: "failed" };
  if (activity.activeTurnId || WORKING_STATUSES.has(status)) return { execution: "working" };
  if (activity.queued > 0) return { execution: "queued" };
  const last = activity.lastSettledTurn;
  if (!last) {
    const age = now - Date.parse(row.createdAt);
    return { execution: age > NOT_STARTED_AFTER_MS ? "not_started" : "starting" };
  }
  if (last.status === "failed") {
    // The row's settled turn carries no failure code today; the ask for one
    // is open with the platform, and a row that carries it is read as is.
    const code = (last as { code?: unknown }).code;
    return { execution: "failed", ...(typeof code === "string" && code ? { failure: { code } } : {}) };
  }
  return { execution: "idle" };
}

/**
 * A committed result whose data fits the report schema; invalid data is
 * logged and treated as no result, because a row must never fail to render
 * over a field the app does not own.
 */
function reportOf(row: SessionSummary): { turnId: string; reportedAt: string; data: Report } | undefined {
  const result = row.result;
  if (!result) return undefined;
  const parsed = reportSchema.safeParse(result.data);
  if (!parsed.success) {
    console.warn(`Session result from turn ${result.turnId} does not match the report schema; ignored.`);
    return undefined;
  }
  return { turnId: result.turnId, reportedAt: result.reportedAt, data: parsed.data };
}

export function toTask(row: SessionSummary, now: number): Task {
  const labels = row.labels ?? {};
  const activity = row.activity ?? NO_ACTIVITY;
  const state = execution(row, now);
  const actorId = Number(labels[LABELS.actorId]);
  const result = reportOf(row);
  return {
    id: row.id,
    execution: state.execution,
    queued: activity.queued,
    ...(state.failure ? { failure: state.failure } : {}),
    archived: labels[LABELS.archived] === "true",
    ...(result
      ? {
          result: {
            ...result.data,
            turnId: result.turnId,
            reportedAt: result.reportedAt,
            stage: reportStage(result.data),
            fromLastTurn: activity.lastSettledTurn?.id === result.turnId,
          },
        }
      : {}),
    title: labels[LABELS.title] || "Untitled task",
    repo: labels[LABELS.repo] ?? "",
    ref: labels[LABELS.ref] ?? "",
    actor: { id: Number.isFinite(actorId) ? actorId : 0, login: labels[LABELS.actorLogin] ?? "" },
    ...(labels[LABELS.continues] ? { continues: labels[LABELS.continues] } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const SETTLED = new Set(["completed", "failed", "cancelled"]);

function later(a: Turn, b: Turn): Turn {
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

/**
 * A session from `GET /sessions/<id>` as a list row, so one `toTask` serves
 * both. The session carries its turns and no `activity`; the row's facts are
 * derived from them.
 */
export function summarize(session: Session, projectId: string): SessionSummary {
  const running = session.turns.find((turn) => turn.status === "running");
  const queued = session.turns.filter((turn) => turn.status === "queued").length;
  const settled = session.turns
    .filter((turn) => SETTLED.has(turn.status))
    .reduce<Turn | undefined>((best, turn) => (best ? later(best, turn) : turn), undefined);
  return {
    id: session.id,
    projectId: session.projectId ?? projectId,
    agentId: session.agentId,
    deploymentId: session.deploymentId,
    environment: session.environment ?? null,
    source: session.source ?? "api",
    status: session.status,
    labels: session.labels ?? {},
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    revision: session.revision ?? 0,
    activity: {
      activeTurnId: running?.id ?? null,
      queued,
      lastSettledTurn: settled ? { id: settled.id, status: settled.status, at: settled.updatedAt } : null,
    },
    result: session.result ?? null,
  };
}
