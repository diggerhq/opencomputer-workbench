// The task page's activity: the hook's `turns`, reduced by @opencomputer/react
// from the session's log (status, input, messages, tool calls keyed by call
// id, the result, the failure), joined with the notes activity-notes.ts takes
// from the same events. The result on a turn is the result tool's output,
// validated against the report schema.
import type { ToolCall as HookToolCall, Turn as HookTurn, ToolCallStatus, TurnStatus } from "@opencomputer/react";
import { type Report, type ReportStage, reportSchema, reportStage } from "@/shared/report";
import type { CallNotes, Notes, TurnNotes } from "./activity-notes";
import { parseOutput } from "./command-output";

export type { ToolCallStatus as CallStatus, TurnStatus };

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
