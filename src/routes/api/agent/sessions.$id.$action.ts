// The three routes the React hook needs, exactly as the React integration
// documents them: GET events from a cursor, POST a turn, POST an interrupt.
// The task guard checks the session's scope; each forwards the request body
// and the response unchanged with the API key added. Nothing else is proxied, and
// nothing is parsed: the hook reads the API's own answers.
import { createFileRoute } from "@tanstack/react-router";
import { handle, problem } from "@/server/problem";
import { type HandledTask, task } from "../../-guards";

const ACTIONS: Record<string, readonly string[]> = { GET: ["events"], POST: ["turns", "interrupt"] };

const forward = handle(async ({ request, params, context }: HandledTask<{ id: string; action: string }>) => {
  const method = request.method.toUpperCase();
  if (!ACTIONS[method]?.includes(params.action)) return problem(404, "not_found", "No such route.");
  const { config: settings, session, fetch } = context;
  const search = new URL(request.url).search;
  const upstream = await fetch(
    `${settings.oc.origin}/api/managed-agents/sessions/${encodeURIComponent(session.id)}/${params.action}${search}`,
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
  server: { middleware: [task], handlers: { GET: forward, POST: forward } },
});
