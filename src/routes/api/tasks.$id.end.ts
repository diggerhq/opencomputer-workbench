// POST /api/tasks/:id/end: end the session; queued and running work is
// cancelled and the task becomes read-only.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@/server/client";
import { config, deps } from "@/server/env";
import { handle } from "@/server/problem";
import { workbenchSession } from "@/server/scope";
import { summarize, toTask } from "@/server/task";
import { type Handled, member } from "../-middleware";

export const Route = createFileRoute("/api/tasks/$id/end")({
  server: {
    middleware: [member],
    handlers: {
      POST: handle(async ({ params }: Handled<{ id: string }>) => {
        const settings = config();
        const { fetch, now } = deps();
        const oc = createClient(settings, fetch);
        await workbenchSession(oc, settings, params.id);
        const session = await oc.sessions.end(params.id);
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
    },
  },
});
