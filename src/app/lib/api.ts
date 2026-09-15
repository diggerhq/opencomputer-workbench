// The browser's view of the app's own routes. One problem shape, one place
// that turns it into an Error; 401 on the workspace route means "signed out".
export interface Workspace {
  readonly identity: { readonly id: number; readonly login: string; readonly avatarUrl: string };
  readonly deploymentId: string;
  readonly environment: "development" | "production";
  readonly membership: { readonly kind: string; readonly display: string };
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
  const body = (await response.json().catch(() => undefined)) as
    | { error?: { code?: string; message?: string } | string }
    | undefined;
  const error = body?.error;
  if (typeof error === "object" && error && typeof error.code === "string") {
    throw new ApiError(response.status, error.code, error.message ?? error.code);
  }
  throw new ApiError(response.status, "request_failed", `The request failed (${String(response.status)}).`);
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
