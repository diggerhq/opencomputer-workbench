// DEV STUB (C2): what the agent knows about its task. The real path reads
// `useInput().payload`, the structured context the app sends with the first
// turn. Until the payload route is live, and only when the app runs with
// WORKBENCH_DEV_STUBS=1, the same fields arrive folded into the first line
// of the text as `[workbench] task=<id> repo=<owner/name> ref=<ref>
// actor=<login>` (src/server/request.ts); this module parses that line back.
// Deleted, together with src/server/request.ts, when `payload` on
// POST /sessions/<id>/turns is live.
import type { AgentInput } from "@opencomputer/agent";

export interface TaskContext {
  readonly taskId: string;
  readonly repo: string;
  readonly ref: string;
  readonly actor: { readonly login: string };
}

export interface ReadTask {
  readonly task: TaskContext;
  /** The request text without the preamble line. */
  readonly text: string;
}

const PREAMBLE = /^\[workbench\] task=(\S+) repo=(\S+) ref=(\S+) actor=(\S+)\s*$/;

function fromPayload(payload: unknown): TaskContext | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const actor = record.actor;
  if (
    typeof record.taskId !== "string" ||
    typeof record.repo !== "string" ||
    typeof record.ref !== "string" ||
    !actor ||
    typeof actor !== "object" ||
    typeof (actor as Record<string, unknown>).login !== "string"
  ) {
    return undefined;
  }
  return {
    taskId: record.taskId,
    repo: record.repo,
    ref: record.ref,
    actor: { login: (actor as Record<string, unknown>).login as string },
  };
}

export function readTask(input: Readonly<AgentInput>): ReadTask | undefined {
  const fromData = fromPayload(input.payload);
  if (fromData) return { task: fromData, text: input.text ?? "" };
  const text = input.text ?? "";
  const newline = text.indexOf("\n");
  const first = newline < 0 ? text : text.slice(0, newline);
  const match = PREAMBLE.exec(first);
  if (!match) return undefined;
  const [, taskId, repo, ref, login] = match;
  if (!taskId || !repo || !ref || !login) return undefined;
  return { task: { taskId, repo, ref, actor: { login } }, text: newline < 0 ? "" : text.slice(newline + 1) };
}
