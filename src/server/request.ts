// What the first turn carries: the request text and the structured task
// context the agent reads with `useInput().payload`. The text stays the
// message; the payload is the context, and follow-ups carry none because the
// conversation holds it.
export interface TaskSubmission {
  readonly taskId: string;
  readonly repo: string;
  readonly ref: string;
  readonly text: string;
  readonly actor: { readonly id: number; readonly login: string };
}

/** A type literal, not an interface, so it is assignable to the client's JSON value type. */
export type TaskPayload = {
  readonly taskId: string;
  readonly repo: string;
  readonly ref: string;
  readonly actor: { readonly id: number; readonly login: string };
};

export interface TaskRequest {
  readonly input: string;
  readonly payload: TaskPayload;
}

export function taskRequest(submission: TaskSubmission): TaskRequest {
  const { taskId, repo, ref, text, actor } = submission;
  return { input: text, payload: { taskId, repo, ref, actor: { id: actor.id, login: actor.login } } };
}
