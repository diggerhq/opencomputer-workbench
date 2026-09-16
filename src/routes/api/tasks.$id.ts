// GET /api/tasks/:id: one task, the session the guard fetched and
// scope-checked, mapped by toTask. PATCH /api/tasks/:id: title and
// archived, as labels.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { untilPublished } from "@/server/client";
import { handle, problem } from "@/server/problem";
import { boundLabels, summarize, toTask } from "@/server/task";
import { LABEL_BOUNDS, LABELS } from "@/shared/task";
import { type HandledTask, task } from "../-guards";

const patchBody = z
  .object({
    title: z.string().trim().min(1).max(LABEL_BOUNDS.valueLength).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.archived !== undefined, "Nothing to change");

export const Route = createFileRoute("/api/tasks/$id")({
  server: {
    middleware: [task],
    handlers: {
      GET: handle(async ({ context }: HandledTask) => {
        const { config: settings, session, now } = context;
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
      PATCH: handle(async ({ request, context }: HandledTask) => {
        const { config: settings, client: oc, now } = context;
        const parsed = patchBody.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
          return problem(400, "invalid_patch", parsed.error.issues[0]?.message ?? "Invalid change");
        }
        const set = boundLabels({
          ...(parsed.data.title !== undefined ? { [LABELS.title]: parsed.data.title } : {}),
          ...(parsed.data.archived !== undefined ? { [LABELS.archived]: parsed.data.archived ? "true" : "false" } : {}),
        });
        const session = await untilPublished(() => oc.sessions.setLabels(context.session.id, { set }));
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
    },
  },
});
