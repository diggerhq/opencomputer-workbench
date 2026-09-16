// The two guards every server route under /api and /auth composes: the
// request must come from the app's own origin when it changes state, and the
// caller must be a member, whose identity the handler then reads from its
// context. A rejected member gets a cleared cookie; a renewed one gets the
// rewritten cookie on the way out. The checks themselves are in server/auth.
import { createMiddleware } from "@tanstack/react-start";
import { clearSessionCookie, type Identity, identity, originAllowed } from "@/server/auth";
import { config, deps } from "@/server/env";
import { problem } from "@/server/problem";

export interface Member {
  readonly identity: Identity;
  readonly membership: { readonly kind: string; readonly display: string };
}

/** What a handler behind `member` receives: the request, its path params and the member. */
export interface Handled<TParams = Record<string, never>> {
  readonly request: Request;
  readonly params: TParams;
  readonly context: { readonly member: Member };
}

/** The configuration, or the problem that names the missing key. */
function settings(): { ok: true; config: ReturnType<typeof config> } | { ok: false; response: Response } {
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
    const found = await identity(request, current.config, deps());
    if (!found) {
      return problem(401, "unauthenticated", "Sign in to use the workbench.", {
        "set-cookie": clearSessionCookie(current.config),
      });
    }
    const result = await next({ context: { member: { identity: found.identity, membership: found.membership } } });
    if (found.setCookie) result.response.headers.append("set-cookie", found.setCookie);
    return result;
  });
