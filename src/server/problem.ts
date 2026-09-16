// The one error shape every route returns: { error: { code, message } }, the
// same envelope the OpenComputer management API uses, so the browser handles
// one kind of failure whether it came from the app or was forwarded. `handle`
// wraps a route handler so every failure leaves through this shape.
import type { Problem } from "../shared/problem";
import { OpenComputerError } from "./client";
import { ScopeError } from "./scope";
import { LabelError } from "./task";

export function problem(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } } satisfies Problem, { status, headers });
}

const FORWARDED_STATUSES = new Set([400, 402, 409, 429, 503]);
/** A 404 that describes the member's situation rather than the workbench's configuration. */
const FORWARDED_NOT_FOUND = new Set(["github_connection_not_found"]);

/** The response a failure becomes: forwarded with its status when it is the API's own answer about this request. */
export function toProblem(cause: unknown): Response {
  if (cause instanceof ScopeError) return problem(404, "not_found", cause.message);
  if (cause instanceof LabelError) return problem(400, "invalid_labels", cause.message);
  if (cause instanceof OpenComputerError) {
    // Refusals, conflicts, an unconfirmed publication, the environment
    // without a GitHub installation keep their status and code. A 401, a
    // 403 or a missing project or route is the workbench's configuration,
    // not the member's, and any other failure is a bad gateway, both
    // carrying the upstream code.
    const forwarded =
      FORWARDED_STATUSES.has(cause.status) || (cause.status === 404 && FORWARDED_NOT_FOUND.has(cause.code));
    return problem(forwarded ? cause.status : 502, cause.code, cause.message);
  }
  console.error(cause);
  return problem(500, "internal_error", "Something went wrong.");
}

/** Wraps a route handler: whatever it throws leaves as a problem. */
export function handle<TContext>(fn: (context: TContext) => Promise<Response> | Response) {
  return async (context: TContext): Promise<Response> => {
    try {
      return await fn(context);
    } catch (cause) {
      return toProblem(cause);
    }
  };
}
