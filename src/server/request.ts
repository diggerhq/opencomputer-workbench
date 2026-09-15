// What the first turn carries: the request text and the structured task
// context the agent reads with `useInput().payload` (C2).
//
// DEV STUB (C2): until the payload route ships, and only when the app runs
// with WORKBENCH_DEV_STUBS=1, the fields are folded into the text as one
// preamble line that the agent's read-task.ts parses back. Deleted, together
// with read-task.ts, when `payload` on POST /sessions/<id>/turns is live.
export interface TaskSubmission {
  readonly taskId: string;
  readonly repo: string;
  readonly ref: string;
  readonly text: string;
  readonly actor: { readonly id: number; readonly login: string };
}

export interface TaskRequest {
  readonly input: string;
  readonly payload?: {
    readonly taskId: string;
    readonly repo: string;
    readonly ref: string;
    readonly actor: { readonly id: number; readonly login: string };
  };
}

export const PREAMBLE = "[workbench]";

export function taskRequest(submission: TaskSubmission, devStubs: boolean): TaskRequest {
  const { taskId, repo, ref, text, actor } = submission;
  if (devStubs) {
    return { input: `${PREAMBLE} task=${taskId} repo=${repo} ref=${ref} actor=${actor.login}\n${text}` };
  }
  return { input: text, payload: { taskId, repo, ref, actor: { id: actor.id, login: actor.login } } };
}
