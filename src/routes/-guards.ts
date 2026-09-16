// The guards the server routes under /api and /auth compose, each one
// providing what the handler behind it reads from its context. `sameOrigin`:
// a request that changes state must come from the app's own origin.
// `member`: the caller is a member; the handler gets the member with the
// configuration, the management client and the host's fetch and clock, so
// no handler wires those itself. `task`: the id in the path names a session
// inside the workbench's scope; the handler gets it fetched and checked. A
// rejected member gets a cleared cookie; a renewed one gets the rewritten
// cookie on the way out. The checks themselves are in server/auth and
// server/scope.
import { createMiddleware } from "@tanstack/react-start";
import { clearSessionCookie, type Identity, identity, originAllowed } from "@/server/auth";
import { type Client, createClient, type Session } from "@/server/client";
import { type Config, config, deps } from "@/server/env";
import { problem, toProblem } from "@/server/problem";
import { workbenchSession } from "@/server/scope";

export interface Member {
  readonly identity: Identity;
  readonly membership: { readonly kind: string; readonly display: string };
}

/** What `member` provides: the caller and the wiring every handler behind it uses. */
export interface Wiring {
  readonly member: Member;
  readonly config: Config;
  /** The management client over the host's fetch. */
  readonly client: Client;
  readonly fetch: typeof globalThis.fetch;
  /** Milliseconds since the epoch. */
  readonly now: () => number;
}

/** What a handler behind `member` receives: the request, its path params and the wiring. */
export interface Handled<TParams = Record<string, never>> {
  readonly request: Request;
  readonly params: TParams;
  readonly context: Wiring;
}

/** What a handler behind `task` receives: the wiring and the session the path names, scope-checked. */
export interface HandledTask<TParams extends { readonly id: string } = { readonly id: string }>
  extends Handled<TParams> {
  readonly context: Wiring & { readonly session: Session };
}

/** The configuration, or the problem that names the missing key. */
function settings(): { ok: true; config: Config } | { ok: false; response: Response } {
  try {
    return { ok: true, config: config() };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, response: problem(500, "misconfigured", message) };
  }
}

export const sameOrigin = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const found = settings();
  if (!found.ok) return found.response;
  if (!originAllowed(request, found.config)) {
    return problem(403, "origin_mismatch", "This request must come from the workbench itself.");
  }
  return next();
});

export const member = createMiddleware({ type: "request" })
  .middleware([sameOrigin])
  .server(async ({ request, next }) => {
    const current = settings();
    if (!current.ok) return current.response;
    const { fetch, now } = deps();
    const found = await identity(request, current.config, { fetch, now });
    if (!found) {
      return problem(401, "unauthenticated", "Sign in to use the workbench.", {
        "set-cookie": clearSessionCookie(current.config),
      });
    }
    const wiring: Wiring = {
      member: { identity: found.identity, membership: found.membership },
      config: current.config,
      client: createClient(current.config, fetch),
      fetch,
      now,
    };
    const result = await next({ context: wiring });
    if (found.setCookie) result.response.headers.append("set-cookie", found.setCookie);
    return result;
  });

// Request middleware sees the path, not its params: the session id is the
// segment after the collection, on both the task routes and the hook's.
const SESSION_ID = /^\/api\/(?:tasks|agent\/sessions)\/([^/]+)/;

export const task = createMiddleware({ type: "request" })
  .middleware([member])
  .server(async ({ pathname, context, next }) => {
    const id = SESSION_ID.exec(pathname)?.[1];
    if (!id) return problem(404, "not_found", "No such route.");
    let session: Session;
    try {
      session = await workbenchSession(context.client, context.config, decodeURIComponent(id));
    } catch (cause) {
      return toProblem(cause);
    }
    return next({ context: { session } });
  });
