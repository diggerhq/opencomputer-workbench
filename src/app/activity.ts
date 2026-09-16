// The task page's activity: the hook's `turns`, reduced by @opencomputer/react
// from the session's log (status, input, messages, tool calls keyed by call
// id, the result, the failure), joined with the notes the page shows and the
// hook does not carry: timestamps for ages and durations, a failed call's
// message and what settled it, how a stop settled, the payload, the session's
// own status. STOPGAP(C5): the notes are read from the same events through
// `onEvent`, by the pure `noteEvent`; deleted when the hook's turns and tool
// calls carry timestamps, messages and settlement themselves.
import type {
  AgentEvent,
  ToolCall as HookToolCall,
  Turn as HookTurn,
  ToolCallStatus,
  TurnStatus,
} from "@opencomputer/react";
import { type Report, type ReportStage, reportSchema, reportStage } from "../lib/report";

export type { ToolCallStatus as CallStatus, TurnStatus };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export interface ToolCall extends HookToolCall, CallNotes {}

export interface Turn extends Omit<HookTurn, "toolCalls" | "result">, TurnNotes {
  readonly toolCalls: readonly ToolCall[];
  /** The result tool's latest committed output, when it fits the report schema. */
  readonly result?: Report;
}

export interface Activity {
  readonly turns: readonly Turn[];
  readonly ended: boolean;
  readonly createdAt?: string;
  readonly status?: string;
  readonly sessionFailure?: { readonly code: string; readonly message: string };
}

/** The hook's turns joined with the notes. Invalid result data leaves a turn without a result. */
export function activityOf(turns: readonly HookTurn[], notes: Notes): Activity {
  return {
    turns: turns.map((turn) => {
      const { result, toolCalls, ...rest } = turn;
      const parsed = result === undefined ? undefined : reportSchema.safeParse(parseOutput(result));
      return {
        ...rest,
        ...notes.turns[turn.id],
        toolCalls: toolCalls.map((call) => {
          const note = notes.calls[`${turn.id}/${call.callId}`];
          // The log records a call a stop settled as `tool.failed` with
          // `settledBy: "turn.cancelled"`; the page shows it as stopped, not failed.
          const status = note?.settledBy === "turn.cancelled" ? "cancelled" : call.status;
          return { ...call, ...note, status };
        }),
        ...(parsed?.success ? { result: parsed.data } : {}),
      };
    }),
    ended: notes.session.ended,
    ...(notes.session.createdAt ? { createdAt: notes.session.createdAt } : {}),
    ...(notes.session.status ? { status: notes.session.status } : {}),
    ...(notes.session.failure ? { sessionFailure: notes.session.failure } : {}),
  };
}

/** The running turn, if the log shows one. */
export function activeTurn(activity: Activity): Turn | undefined {
  for (let index = activity.turns.length - 1; index >= 0; index -= 1) {
    const turn = activity.turns[index];
    if (turn?.status === "running") return turn;
  }
  return undefined;
}

export function isSettled(turn: Turn): boolean {
  return turn.status === "completed" || turn.status === "failed" || turn.status === "cancelled";
}

export interface LatestResult {
  readonly report: Report;
  readonly stage: ReportStage;
  /** The turn that reported it, one-based in log order. */
  readonly turnNumber: number;
  readonly turn: Turn;
  /** The reporting turn is the last settled one. */
  readonly fromLastTurn: boolean;
}

/** The session's result as the log shows it: the latest turn that committed one, with its provenance. */
export function latestResult(activity: Activity): LatestResult | undefined {
  let lastSettled: Turn | undefined;
  for (const turn of activity.turns) if (isSettled(turn)) lastSettled = turn;
  for (let index = activity.turns.length - 1; index >= 0; index -= 1) {
    const turn = activity.turns[index];
    if (turn?.result) {
      return {
        report: turn.result,
        stage: reportStage(turn.result),
        turnNumber: index + 1,
        turn,
        fromLastTurn: lastSettled === undefined || lastSettled.id === turn.id,
      };
    }
  }
  return undefined;
}

export type OutcomeKind = "running" | "ok" | "error" | "timed_out" | "failed" | "cancelled";

export interface CommandOutcome {
  readonly kind: OutcomeKind;
  readonly exitCode?: number;
  /** The output as text: stdout then stderr, or the failure message. */
  readonly text: string;
  readonly lines: number;
  readonly durationMs?: number;
}

/**
 * A tool's output as the runtime records it. The computer's commands come
 * back as one JSON string encoding `{ stdout, stderr, exitCode, signal,
 * timedOut, terminated, truncated, durationMs }` (recorded on Development,
 * fixtures/logs/recorded); an object is read as is, any other string is the
 * output itself.
 */
export function parseOutput(output: unknown): unknown {
  if (typeof output !== "string") return output;
  const text = output.trimStart();
  if (!text.startsWith("{")) return output;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : output;
  } catch {
    return output;
  }
}

function outputText(output: unknown): string {
  if (typeof output === "string") return output;
  if (isRecord(output)) {
    const parts = [output.stdout, output.stderr, output.output].filter((part) => typeof part === "string" && part);
    if (parts.length) return parts.join("\n");
    if (output.stdout === "" || output.stderr === "") return "";
  }
  if (output === undefined || output === null) return "";
  return JSON.stringify(output, null, 2);
}

function countLines(value: string): number {
  return value ? value.replace(/\n$/, "").split("\n").length : 0;
}

/** What a call's row says on the right: running, ok with its duration, a non-zero exit, a timeout, a failure or a stop. */
export function commandOutcome(call: ToolCall): CommandOutcome {
  const elapsed =
    call.startedAt && call.settledAt ? Date.parse(call.settledAt) - Date.parse(call.startedAt) : undefined;
  if (call.status === "running") return { kind: "running", text: "", lines: 0 };
  if (call.status === "failed" || call.status === "cancelled") {
    const message = call.message ?? "";
    return {
      kind: call.status,
      text: message,
      lines: countLines(message),
      ...(elapsed !== undefined ? { durationMs: elapsed } : {}),
    };
  }
  const output = parseOutput(call.output);
  const record = isRecord(output) ? output : {};
  const durationMs = typeof record.durationMs === "number" ? record.durationMs : elapsed;
  const exitCode = typeof record.exitCode === "number" ? record.exitCode : undefined;
  const timedOut = record.timedOut === true;
  const body = outputText(output);
  return {
    kind: timedOut ? "timed_out" : exitCode !== undefined && exitCode !== 0 ? "error" : "ok",
    ...(exitCode !== undefined ? { exitCode } : {}),
    text: body,
    lines: countLines(body),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

/** The command a call ran, when its input names one; the title otherwise. */
export function commandOf(call: ToolCall): string {
  if (isRecord(call.input) && typeof call.input.command === "string") return call.input.command;
  return call.title;
}
