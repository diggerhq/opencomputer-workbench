// STOPGAP(C5): the pure reduction of a session's event log into turns, tool
// calls and results, keyed by stable ids so a replay from zero and a live
// stream produce the same activity. Deleted, with no behavior change, when
// `useAgent` exposes `turns` with `toolCalls` and `result` (design C5); until
// then this is the only module that reads tool and turn events. No React and
// no network here.
import { type Report, type ReportStage, reportSchema, reportStage } from "../lib/report";

/** One entry of the session log, as `GET /sessions/<id>/events` returns it. */
export interface ActivityEvent {
  readonly id?: string;
  readonly seq: number;
  readonly timestamp?: string;
  readonly sessionId?: string;
  readonly turnId?: string;
  readonly type: string;
  readonly data?: Record<string, unknown>;
}

export type TurnStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type CallStatus = "running" | "completed" | "failed" | "cancelled";
export type TurnMode = "queue" | "steer" | "interrupt";

export interface ActivityMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly streaming: boolean;
}

export interface ToolCall {
  /** `data.callId`, or `tool:<seq>` when the runtime named none. */
  readonly callId: string;
  readonly tool: string;
  readonly title: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly progress?: unknown;
  readonly status: CallStatus;
  /** The failure message of a `tool.failed` call, or why an unsettled call ended with its turn. */
  readonly message?: string;
  /** The terminal turn event that settled a call still open when the turn ended (`tool.failed.data.settledBy`). */
  readonly settledBy?: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
  /** The result tool's call: its output became the session's result. */
  readonly result: boolean;
  readonly seq: number;
}

export interface TurnFailure {
  readonly code: string;
  readonly message: string;
  readonly tool?: string;
  readonly model?: string;
}

export interface Turn {
  readonly id: string;
  readonly status: TurnStatus;
  readonly input: string;
  readonly mode: TurnMode;
  /** The structured value the turn was sent with, as `message.received` records it. */
  readonly payload?: unknown;
  readonly createdAt?: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
  readonly messages: readonly ActivityMessage[];
  readonly toolCalls: readonly ToolCall[];
  readonly result?: Report;
  readonly resultCallId?: string;
  readonly failure?: TurnFailure;
  /** `interrupted` on a stopped turn; `session_ended` when the session ended under it. */
  readonly cancelReason?: string;
  /** How a stop settled, from `turn.cancelled`: the wait, the commands stopped, and whether the computer was replaced. */
  readonly settlement?: {
    readonly afterMs?: number;
    readonly operations?: number;
    readonly computerTerminated?: boolean;
  };
}

export interface Activity {
  /** The highest `seq` applied; events at or below it are ignored. */
  readonly cursor: number;
  readonly turns: readonly Turn[];
  readonly createdAt?: string;
  readonly agentId?: string;
  readonly deploymentId?: string;
  /** The session status as of the cursor, from `session.status_changed`. */
  readonly status?: string;
  readonly ended: boolean;
  readonly sessionFailure?: { readonly code: string; readonly message: string };
}

export function emptyActivity(): Activity {
  return { cursor: 0, turns: [], ended: false };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inputMessageId(turnId: string): string {
  return `turn:${turnId}:input`;
}

function replyMessageId(turnId: string): string {
  return `turn:${turnId}:reply`;
}

function upsertMessage(messages: readonly ActivityMessage[], message: ActivityMessage): ActivityMessage[] {
  const index = messages.findIndex((candidate) => candidate.id === message.id);
  if (index < 0) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

function upsertCall(calls: readonly ToolCall[], call: ToolCall): ToolCall[] {
  const index = calls.findIndex((candidate) => candidate.callId === call.callId);
  if (index < 0) return [...calls, call];
  const next = [...calls];
  next[index] = call;
  return next;
}

function turnFor(activity: Activity, event: ActivityEvent): Turn | undefined {
  return event.turnId ? activity.turns.find((turn) => turn.id === event.turnId) : undefined;
}

function withTurn(activity: Activity, turn: Turn): Activity {
  const index = activity.turns.findIndex((candidate) => candidate.id === turn.id);
  const turns = [...activity.turns];
  if (index < 0) turns.push(turn);
  else turns[index] = turn;
  return { ...activity, turns };
}

/** The turn an event belongs to, created lazily when the log named it first here. */
function ensureTurn(activity: Activity, event: ActivityEvent): Turn | undefined {
  if (!event.turnId) return undefined;
  return (
    turnFor(activity, event) ?? {
      id: event.turnId,
      status: "queued",
      input: "",
      mode: "queue",
      ...(event.timestamp ? { createdAt: event.timestamp } : {}),
      messages: [],
      toolCalls: [],
    }
  );
}

/** The call a progress or completion belongs to: by id, else the last running call of that tool. */
function findCall(turn: Turn, data: Record<string, unknown>): ToolCall | undefined {
  const callId = text(data.callId);
  if (callId) return turn.toolCalls.find((call) => call.callId === callId);
  const tool = text(data.tool);
  for (let index = turn.toolCalls.length - 1; index >= 0; index -= 1) {
    const call = turn.toolCalls[index];
    if (call && call.status === "running" && call.tool === tool) return call;
  }
  return undefined;
}

/**
 * A call still running when its turn ends. The log records a `tool.failed`
 * with `settledBy` for it ahead of the terminal event, so this is a rule of
 * last resort for logs recorded before that; a stop settles the call as
 * `cancelled`, any other end as `failed`.
 */
function settleOpenCalls(
  turn: Turn,
  message: string,
  at: string | undefined,
  status: "failed" | "cancelled" = "failed",
): readonly ToolCall[] {
  if (!turn.toolCalls.some((call) => call.status === "running")) return turn.toolCalls;
  return turn.toolCalls.map((call) =>
    call.status === "running" ? { ...call, status, message, ...(at ? { settledAt: at } : {}) } : call,
  );
}

function settleMessages(messages: readonly ActivityMessage[]): readonly ActivityMessage[] {
  if (!messages.some((message) => message.streaming)) return messages;
  return messages.map((message) => (message.streaming ? { ...message, streaming: false } : message));
}

/**
 * Applies one event. Events at or below the cursor are ignored, so a page
 * that overlaps an earlier one changes nothing and replay equals live.
 */
export function applyEvent(activity: Activity, event: ActivityEvent): Activity {
  if (event.seq <= activity.cursor) return activity;
  const next: Activity = { ...activity, cursor: event.seq };
  const data = event.data ?? {};
  const at = event.timestamp;
  switch (event.type) {
    case "session.created":
      return {
        ...next,
        ...(at ? { createdAt: at } : {}),
        agentId: text(data.agentId),
        deploymentId: text(data.deploymentId),
      };
    case "session.status_changed":
      return { ...next, status: text(data.to) };
    case "session.ended":
      return {
        ...withEveryTurn(next, (turn) =>
          turn.status === "queued" || turn.status === "running"
            ? {
                ...turn,
                status: "cancelled",
                cancelReason: "session_ended",
                ...(at ? { settledAt: at } : {}),
                toolCalls: settleOpenCalls(turn, "The task ended before this call returned.", at, "cancelled"),
                messages: settleMessages(turn.messages),
              }
            : turn,
        ),
        ended: true,
      };
    case "session.failed":
      return { ...next, sessionFailure: { code: text(data.code), message: text(data.message) } };
    case "message.received": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const input = text(data.input);
      const mode = data.mode === "steer" || data.mode === "interrupt" ? data.mode : "queue";
      return withTurn(next, {
        ...turn,
        input,
        mode,
        ...(data.payload !== undefined ? { payload: data.payload } : {}),
        ...(at && !turn.createdAt ? { createdAt: at } : {}),
        messages: upsertMessage(turn.messages, {
          id: inputMessageId(turn.id),
          role: "user",
          text: input,
          streaming: false,
        }),
      });
    }
    case "turn.queued": {
      const turn = ensureTurn(next, event);
      return turn ? withTurn(next, turn.status === "queued" ? turn : { ...turn, status: "queued" }) : next;
    }
    case "turn.started": {
      const turn = ensureTurn(next, event);
      return turn ? withTurn(next, { ...turn, status: "running", ...(at ? { startedAt: at } : {}) }) : next;
    }
    case "turn.completed": {
      const turn = ensureTurn(next, event);
      return turn
        ? withTurn(next, {
            ...turn,
            status: "completed",
            ...(at ? { settledAt: at } : {}),
            messages: settleMessages(turn.messages),
          })
        : next;
    }
    case "turn.failed": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const failure: TurnFailure = {
        code: text(data.code) || "agent_failed",
        message: text(data.message),
        ...(text(data.tool) ? { tool: text(data.tool) } : {}),
        ...(text(data.model) ? { model: text(data.model) } : {}),
      };
      return withTurn(next, {
        ...turn,
        status: "failed",
        failure,
        ...(at ? { settledAt: at } : {}),
        toolCalls: settleOpenCalls(turn, "The turn failed before this call returned.", at),
        messages: settleMessages(turn.messages),
      });
    }
    case "turn.cancelled": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const settlement = {
        ...(typeof data.settledAfterMs === "number" ? { afterMs: data.settledAfterMs } : {}),
        ...(typeof data.operationsSettled === "number" ? { operations: data.operationsSettled } : {}),
        ...(typeof data.computerTerminated === "boolean" ? { computerTerminated: data.computerTerminated } : {}),
      };
      return withTurn(next, {
        ...turn,
        status: "cancelled",
        cancelReason: text(data.reason) || "interrupted",
        ...(Object.keys(settlement).length ? { settlement } : {}),
        ...(at ? { settledAt: at } : {}),
        toolCalls: settleOpenCalls(turn, "Stopped before this call returned.", at, "cancelled"),
        messages: settleMessages(turn.messages),
      });
    }
    case "tool.started": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const call: ToolCall = {
        callId: text(data.callId) || `tool:${String(event.seq)}`,
        tool: text(data.tool),
        title: text(data.title),
        ...(data.input !== undefined ? { input: data.input } : {}),
        status: "running",
        ...(at ? { startedAt: at } : {}),
        result: false,
        seq: event.seq,
      };
      return withTurn(next, { ...turn, toolCalls: upsertCall(turn.toolCalls, call) });
    }
    case "tool.progress": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const call = findCall(turn, data);
      if (!call) return next;
      const { tool: _tool, callId: _callId, title: _title, ...progress } = data;
      return withTurn(next, { ...turn, toolCalls: upsertCall(turn.toolCalls, { ...call, progress }) });
    }
    case "tool.completed": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const existing = findCall(turn, data);
      const isResult = data.result === true;
      const call: ToolCall = {
        callId: existing?.callId ?? (text(data.callId) || `tool:${String(event.seq)}`),
        tool: existing?.tool || text(data.tool),
        title: text(data.title) || existing?.title || "",
        ...(existing?.input !== undefined ? { input: existing.input } : {}),
        ...(existing?.progress !== undefined ? { progress: existing.progress } : {}),
        ...(data.output !== undefined ? { output: data.output } : {}),
        status: "completed",
        ...(existing?.startedAt ? { startedAt: existing.startedAt } : {}),
        ...(at ? { settledAt: at } : {}),
        result: isResult,
        seq: existing?.seq ?? event.seq,
      };
      const parsed = isResult ? reportSchema.safeParse(data.output) : undefined;
      return withTurn(next, {
        ...turn,
        toolCalls: upsertCall(turn.toolCalls, call),
        ...(parsed?.success ? { result: parsed.data, resultCallId: call.callId } : {}),
      });
    }
    case "tool.failed": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const existing = findCall(turn, data);
      // A call its turn ended before it completed is recorded by the session
      // with `settledBy`; a stop settles it as cancelled, any other end as failed.
      const settledBy = text(data.settledBy);
      const call: ToolCall = {
        callId: existing?.callId ?? (text(data.callId) || `tool:${String(event.seq)}`),
        tool: existing?.tool || text(data.tool),
        title: text(data.title) || existing?.title || "",
        ...(existing?.input !== undefined ? { input: existing.input } : {}),
        status: settledBy === "turn.cancelled" ? "cancelled" : "failed",
        message: text(data.message),
        ...(settledBy ? { settledBy } : {}),
        ...(existing?.startedAt ? { startedAt: existing.startedAt } : {}),
        ...(at ? { settledAt: at } : {}),
        result: false,
        seq: existing?.seq ?? event.seq,
      };
      return withTurn(next, { ...turn, toolCalls: upsertCall(turn.toolCalls, call) });
    }
    case "message.delta": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      const id = replyMessageId(turn.id);
      const existing = turn.messages.find((message) => message.id === id);
      return withTurn(next, {
        ...turn,
        messages: upsertMessage(turn.messages, {
          id,
          role: "assistant",
          text: (existing?.text ?? "") + text(data.text),
          streaming: true,
        }),
      });
    }
    case "message.completed": {
      const turn = ensureTurn(next, event);
      if (!turn) return next;
      return withTurn(next, {
        ...turn,
        messages: upsertMessage(turn.messages, {
          id: replyMessageId(turn.id),
          role: "assistant",
          text: text(data.text),
          streaming: false,
        }),
      });
    }
    default:
      return next;
  }
}

function withEveryTurn(activity: Activity, update: (turn: Turn) => Turn): Activity {
  return { ...activity, turns: activity.turns.map(update) };
}

export function applyEvents(activity: Activity, events: readonly ActivityEvent[]): Activity {
  return events.reduce(applyEvent, activity);
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

/** What a call's row says on the right: running, ok with its duration, a non-zero exit, a timeout, or a failure. */
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
  const output = call.output;
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
