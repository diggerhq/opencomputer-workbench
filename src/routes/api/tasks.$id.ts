// GET /api/tasks/:id: one task, the session fetched, scope-checked and
// mapped by toTask. PATCH /api/tasks/:id: title and archived, as labels.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient, untilPublished } from "@/server/client";
import { config, deps } from "@/server/env";
import { handle, problem } from "@/server/problem";
import { workbenchSession } from "@/server/scope";
import { boundLabels, summarize, toTask } from "@/server/task";
import { LABEL_BOUNDS, LABELS } from "@/shared/task";
import { type Handled, member } from "../-middleware";

const patchBody = z
  .object({
    title: z.string().trim().min(1).max(LABEL_BOUNDS.valueLength).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.archived !== undefined, "Nothing to change");

export const Route = createFileRoute("/api/tasks/$id")({
  server: {
    middleware: [member],
    handlers: {
      GET: handle(async ({ params }: Handled<{ id: string }>) => {
        const settings = config();
        const { fetch, now } = deps();
        const session = await workbenchSession(createClient(settings, fetch), settings, params.id);
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
      PATCH: handle(async ({ request, params }: Handled<{ id: string }>) => {
        const settings = config();
        const { fetch, now } = deps();
        const oc = createClient(settings, fetch);
        const parsed = patchBody.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
          return problem(400, "invalid_patch", parsed.error.issues[0]?.message ?? "Invalid change");
        }
        await workbenchSession(oc, settings, params.id);
        const set = boundLabels({
          ...(parsed.data.title !== undefined ? { [LABELS.title]: parsed.data.title } : {}),
          ...(parsed.data.archived !== undefined ? { [LABELS.archived]: parsed.data.archived ? "true" : "false" } : {}),
        });
        const session = await untilPublished(() => oc.sessions.setLabels(params.id, { set }));
        return Response.json({ task: toTask(summarize(session, settings.oc.projectId), now()) });
      }),
    },
  },
});
