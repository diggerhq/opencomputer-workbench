// STOPGAP(C5): what the task page shows and the hook's `turns` do not carry
// yet: timestamps for ages and durations, a failed call's message and what
// settled it, how a stop settled, the payload, the session's own status. The
// notes are taken from the same events the hook applies, through `onEvent`,
// by the pure `noteEvent`, and joined onto the hook's turns in activity.ts.
// Deleted whole, with the join's use of it, when the hook's turns and tool
// calls carry timestamps, messages and settlement themselves.
import type { AgentEvent } from "@opencomputer/react";

export interface CallNotes {
  readonly startedAt?: string;
  readonly settledAt?: string;
  /** The failure message of a `tool.failed` call, or why an unsettled call ended with its turn. */
  readonly message?: string;
  /** The terminal turn event that settled a call still open when the turn ended (`tool.failed.data.settledBy`). */
  readonly settledBy?: string;
  readonly progress?: unknown;
  /** The result tool's call: its output became the session's result. */
  readonly result?: boolean;
}

export interface Settlement {
  readonly afterMs?: number;
  readonly operations?: number;
  readonly computerTerminated?: boolean;
}

export interface TurnNotes {
  readonly createdAt?: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
  readonly mode?: "queue" | "steer" | "interrupt";
  /** The structured value the turn was sent with, as `message.received` records it. */
  readonly payload?: unknown;
  /** `interrupted` on a stopped turn; `session_ended` when the session ended under it. */
  readonly cancelReason?: string;
  /** How a stop settled, from `turn.cancelled`: the wait, the commands stopped, and whether the computer was replaced. */
  readonly settlement?: Settlement;
}

export interface SessionNotes {
  readonly createdAt?: string;
  /** The session status as of the cursor, from `session.status_changed`. */
  readonly status?: string;
  readonly ended: boolean;
  readonly failure?: { readonly code: string; readonly message: string };
}

/** What the page keeps beside the hook's turns, keyed like the hook keys them. */
export interface Notes {
  /** The highest `seq` noted; events at or below it change nothing. */
  readonly cursor: number;
  readonly session: SessionNotes;
  readonly turns: Readonly<Record<string, TurnNotes>>;
  readonly calls: Readonly<Record<string, CallNotes>>;
}

export function emptyNotes(): Notes {
  return { cursor: 0, session: { ended: false }, turns: {}, calls: {} };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The key a call's notes live under: the runtime's call id, else the hook's fallback on the sequence. */
function callKey(turnId: string, data: Record<string, unknown>, seq: number): string {
  return `${turnId}/${text(data.callId) || `tool:${String(seq)}`}`;
}

function withTurn(notes: Notes, turnId: string, patch: TurnNotes): Notes {
  return { ...notes, turns: { ...notes.turns, [turnId]: { ...notes.turns[turnId], ...patch } } };
}

function withCall(notes: Notes, key: string, patch: CallNotes): Notes {
  return { ...notes, calls: { ...notes.calls, [key]: { ...notes.calls[key], ...patch } } };
}

/** Notes one event; pure, and ignores events at or below the cursor so a replayed page changes nothing. */
export function noteEvent(notes: Notes, event: AgentEvent): Notes {
  if (event.seq <= notes.cursor) return notes;
  const next: Notes = { ...notes, cursor: event.seq };
  const data = event.data ?? {};
  const at = event.timestamp;
  const turnId = event.turnId;
  switch (event.type) {
    case "session.created":
      return { ...next, session: { ...next.session, ...(at ? { createdAt: at } : {}) } };
    case "session.status_changed":
      return { ...next, session: { ...next.session, status: text(data.to) } };
    case "session.ended":
      return { ...next, session: { ...next.session, ended: true } };
    case "session.failed":
      return { ...next, session: { ...next.session, failure: { code: text(data.code), message: text(data.message) } } };
    case "message.received":
      if (!turnId) return next;
      return withTurn(next, turnId, {
        ...(at && !next.turns[turnId]?.createdAt ? { createdAt: at } : {}),
        ...(data.mode === "steer" || data.mode === "interrupt" ? { mode: data.mode } : { mode: "queue" }),
        ...(data.payload !== undefined ? { payload: data.payload } : {}),
      });
    case "turn.queued":
      if (!turnId) return next;
      return withTurn(next, turnId, at && !next.turns[turnId]?.createdAt ? { createdAt: at } : {});
    case "turn.started":
      if (!turnId) return next;
      return withTurn(next, turnId, at ? { startedAt: at } : {});
    case "turn.completed":
    case "turn.failed":
      if (!turnId) return next;
      return withTurn(next, turnId, at ? { settledAt: at } : {});
    case "turn.cancelled": {
      if (!turnId) return next;
      const settlement: Settlement = {
        ...(typeof data.settledAfterMs === "number" ? { afterMs: data.settledAfterMs } : {}),
        ...(typeof data.operationsSettled === "number" ? { operations: data.operationsSettled } : {}),
        ...(typeof data.computerTerminated === "boolean" ? { computerTerminated: data.computerTerminated } : {}),
      };
      return withTurn(next, turnId, {
        cancelReason: text(data.reason) || "interrupted",
        ...(Object.keys(settlement).length ? { settlement } : {}),
        ...(at ? { settledAt: at } : {}),
      });
    }
    case "tool.started":
      if (!turnId) return next;
      return withCall(next, callKey(turnId, data, event.seq), at ? { startedAt: at } : {});
    case "tool.progress": {
      if (!turnId) return next;
      const { tool: _tool, callId: _callId, title: _title, ...progress } = data;
      return withCall(next, callKey(turnId, data, event.seq), { progress });
    }
    case "tool.completed":
      if (!turnId) return next;
      return withCall(next, callKey(turnId, data, event.seq), {
        ...(at ? { settledAt: at } : {}),
        ...(data.result === true ? { result: true } : {}),
      });
    case "tool.failed":
      if (!turnId) return next;
      return withCall(next, callKey(turnId, data, event.seq), {
        ...(at ? { settledAt: at } : {}),
        message: text(data.message),
        ...(text(data.settledBy) ? { settledBy: text(data.settledBy) } : {}),
      });
    default:
      return next;
  }
}

export function noteEvents(notes: Notes, events: readonly AgentEvent[]): Notes {
  return events.reduce(noteEvent, notes);
}
