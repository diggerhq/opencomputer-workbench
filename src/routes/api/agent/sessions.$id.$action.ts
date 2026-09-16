// The three routes the React hook needs, exactly as the React integration
// documents them: GET events from a cursor, POST a turn, POST an interrupt.
// Each checks the session's scope, then forwards the request body and the
// response unchanged with the API key added. Nothing else is proxied, and
// nothing is parsed: the hook reads the API's own answers.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@/server/client";
import { config, deps } from "@/server/env";
import { handle, problem } from "@/server/problem";
import { workbenchSession } from "@/server/scope";
import { type Handled, member } from "../../-middleware";

const ACTIONS: Record<string, readonly string[]> = { GET: ["events"], POST: ["turns", "interrupt"] };

const forward = handle(async ({ request, params }: Handled<{ id: string; action: string }>) => {
  const method = request.method.toUpperCase();
  if (!ACTIONS[method]?.includes(params.action)) return problem(404, "not_found", "No such route.");
  const settings = config();
  const { fetch } = deps();
  await workbenchSession(createClient(settings, fetch), settings, params.id);
  const search = new URL(request.url).search;
  const upstream = await fetch(
    `${settings.oc.origin}/api/managed-agents/sessions/${encodeURIComponent(params.id)}/${params.action}${search}`,
    {
      method,
      headers: {
        "x-api-key": settings.oc.apiKey,
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: await request.text() } : {}),
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

export const Route = createFileRoute("/api/agent/sessions/$id/$action")({
  server: { middleware: [member], handlers: { GET: forward, POST: forward } },
});
