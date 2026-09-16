// The three routes the React hook needs, exactly as the React integration
// documents them: the event log from a cursor, a new turn, an interrupt.
// Each checks the session's scope, then forwards the request body and the
// response unchanged with the API key added. Nothing else is proxied, and
// nothing is parsed: the hook reads the API's own answers.
import { Hono } from "hono";
import type { Client } from "./client";
import type { Config } from "./env";
import type { Variables } from "./routes";
import { workbenchSession } from "./scope";

const ROUTES: Record<string, string[]> = { GET: ["events"], POST: ["turns", "interrupt"] };

export function sessionProxy(
  config: Config,
  oc: Client,
  fetchImpl: typeof globalThis.fetch,
): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.on(["GET", "POST"], "/api/agent/sessions/:id/:action", async (c) => {
    const method = c.req.method.toUpperCase();
    const action = c.req.param("action");
    if (!ROUTES[method]?.includes(action)) return c.notFound();
    const id = c.req.param("id");
    await workbenchSession(oc, config, id);
    const search = new URL(c.req.url).search;
    const upstream = await fetchImpl(
      `${config.oc.origin}/api/managed-agents/sessions/${encodeURIComponent(id)}/${action}${search}`,
      {
        method,
        headers: {
          "x-api-key": config.oc.apiKey,
          accept: "application/json",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: await c.req.text() } : {}),
        // Never follow a redirect with the key attached.
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  });

  return app;
}
