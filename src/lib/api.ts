// The browser's view of the app's own routes. One problem shape, one place
// that turns it into an Error; 401 on the workspace route means "signed out".
import type { Problem } from "@/shared/problem";
import type { Task } from "@/shared/task";
import type { Envelope, Receipt } from "./submission";

export type { Task };

export interface Workspace {
  readonly identity: { readonly id: number; readonly login: string; readonly avatarUrl: string };
  readonly environment: "development" | "production";
  readonly membership: { readonly kind: string; readonly display: string };
}

export interface Repository {
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly private: boolean;
}

export interface TaskPage {
  readonly tasks: Task[];
  readonly nextCursor: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(response: Response): Promise<never> {
  const body = (await response.json().catch(() => undefined)) as Partial<Problem> | { error?: string } | undefined;
  const error = body?.error;
  if (typeof error === "object" && error && typeof error.code === "string") {
    throw new ApiError(response.status, error.code, error.message ?? error.code);
  }
  throw new ApiError(response.status, "request_failed", `The request failed (${String(response.status)}).`);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) return fail(response);
  return (await response.json()) as T;
}

export async function fetchWorkspace(): Promise<Workspace | null> {
  const response = await fetch("/api/workspace", { headers: { accept: "application/json" } });
  if (response.status === 401) return null;
  if (!response.ok) return fail(response);
  return (await response.json()) as Workspace;
}

export async function signOut(): Promise<void> {
  const response = await fetch("/auth/logout", { method: "POST" });
  if (!response.ok && response.status !== 401) return fail(response);
}

export function listTasks(query: { archived: boolean; cursor?: string | null }): Promise<TaskPage> {
  const params = new URLSearchParams();
  if (query.archived) params.set("archived", "true");
  if (query.cursor) params.set("cursor", query.cursor);
  const search = params.toString();
  return request<TaskPage>(`/api/tasks${search ? `?${search}` : ""}`);
}

export function getTask(id: string): Promise<Task> {
  return request<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`).then((body) => body.task);
}

/** Starts a task; resolves with the session id to navigate to and the first turn's admission receipt. */
export function createTask(envelope: Envelope): Promise<{ id: string; receipt: Receipt }> {
  return request("/api/tasks", { method: "POST", body: JSON.stringify(envelope) });
}

export function patchTask(id: string, patch: { title?: string; archived?: boolean }): Promise<Task> {
  return request<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((body) => body.task);
}

export function endTask(id: string): Promise<Task> {
  return request<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}/end`, { method: "POST" }).then(
    (body) => body.task,
  );
}

export function listRepos(): Promise<{ repositories: Repository[]; nextCursor: string | null }> {
  return request("/api/repos");
}
