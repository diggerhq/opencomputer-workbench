// What a computer command's row says and shows: the runtime records a
// command's result as one JSON string encoding `{ stdout, stderr, exitCode,
// signal, timedOut, terminated, truncated, durationMs }` (recorded on
// Development, dev/fixtures/logs/recorded); this module reads it and turns a
// call into its outcome and its text.
import type { ToolCall } from "./activity";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
 * dev/fixtures/logs/recorded); an object is read as is, any other string is the
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
