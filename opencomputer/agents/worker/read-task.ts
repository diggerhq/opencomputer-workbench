// What the agent knows about its task: the structured context the app sends
// with the first turn, read from `useInput().payload`. A follow-up carries
// none; the conversation holds the context by then.
import type { AgentInput } from "@opencomputer/agent";

export interface TaskContext {
  readonly taskId: string;
  readonly repo: string;
  readonly ref: string;
  readonly actor: { readonly login: string };
}

export interface ReadTask {
  readonly task: TaskContext;
  /** The request text. */
  readonly text: string;
}

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
  const task = fromPayload(input.payload);
  return task ? { task, text: input.text ?? "" } : undefined;
}
