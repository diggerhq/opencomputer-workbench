// POST /api/tasks/:id/end: end the session; queued and running work is
// cancelled and the task becomes read-only.
import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/server/problem";
import { summarize, toTask } from "@/server/task";
import { type HandledTask, task } from "../-guards";

export const Route = createFileRoute("/api/tasks/$id/end")({
  server: {
    middleware: [task],
    handlers: {
      POST: handle(async ({ context }: HandledTask) => {
        const { config: settings, client: oc, now } = context;
        const session = await oc.sessions.end(context.session.id);
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
    },
  },
});
