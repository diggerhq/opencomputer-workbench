// The route table. Every /api route first requires a member; POST and PATCH
// also require the app's own origin. Session-scoped routes (W2, W3) add the
// project, environment and agent check before forwarding.
import { Hono, type MiddlewareHandler } from "hono";
import { type AuthDeps, callback, clearSessionCookie, defaultDeps, type Identity, identity, login } from "./auth";
import type { Config } from "./env";
import { createOC, OCError } from "./oc";
import { problem } from "./problem";

export interface Variables {
  identity: Identity;
  membership: { kind: string; display: string };
}

export type App = Hono<{ Variables: Variables }>;

function requestOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  if (req.headers.get("sec-fetch-site") === "same-origin") return new URL(req.url).origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** Rejects a state-changing request that did not come from the app's own origin. */
export function requireSameOrigin(config: Config): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    if (requestOrigin(c.req.raw) !== config.origin) {
      return problem(c, 403, "origin_mismatch", "This request must come from the workbench itself.");
    }
    return next();
  };
}

/** Requires a member; clears the cookie on a rejected one; forwards a renewed cookie. */
export function requireMember(config: Config, deps: AuthDeps): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const found = await identity(c.req.raw, config, deps);
    if (!found) {
      c.header("set-cookie", clearSessionCookie(config));
      return problem(c, 401, "unauthenticated", "Sign in to use the workbench.");
    }
    c.set("identity", found.identity);
    c.set("membership", found.membership);
    await next();
    if (found.setCookie) c.res.headers.append("set-cookie", found.setCookie);
  };
}

export function routes(config: Config, deps: AuthDeps = defaultDeps): App {
  const app: App = new Hono();
  const oc = createOC(config, deps.fetch);

  app.get("/auth/login", () => login(config));
  app.get("/auth/callback", (c) => callback(c.req.raw, config, deps));
  app.post("/auth/logout", requireSameOrigin(config), (c) => {
    c.header("set-cookie", clearSessionCookie(config));
    return c.body(null, 204);
  });

  app.use("/api/*", requireSameOrigin(config), requireMember(config, deps));

  app.get("/api/workspace", async (c) => {
    const deploymentId = await oc.agents.activeDeployment(config.oc.agentId, config.oc.environment);
    if (!deploymentId) {
      return problem(
        c,
        409,
        "agent_not_deployed",
        `The agent is not deployed to ${config.oc.environment} in this project.`,
      );
    }
    return c.json({
      identity: c.get("identity"),
      deploymentId,
      environment: config.oc.environment,
      membership: c.get("membership"),
    });
  });

  app.notFound((c) => problem(c, 404, "not_found", "No such route."));
  app.onError((cause, c) => {
    if (cause instanceof OCError) return problem(c, 502, cause.code, cause.message);
    console.error(cause);
    return problem(c, 500, "internal_error", "Something went wrong.");
  });
  return app;
}
