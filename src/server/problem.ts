// The one error shape every route returns: { error: { code, message } }, the
// same envelope the OpenComputer management API uses, so the browser handles
// one kind of failure whether it came from the app or was forwarded.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface Problem {
  readonly error: { readonly code: string; readonly message: string };
}

export function problem(c: Context, status: ContentfulStatusCode, code: string, message: string): Response {
  return c.json<Problem>({ error: { code, message } }, status);
}
