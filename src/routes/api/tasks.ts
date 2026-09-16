// GET /api/tasks: one page of the list, one OpenComputer call, rows mapped
// by toTask. POST /api/tasks: start work safely from a stateless handler,
// two calls under the task id the composer minted.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OpenComputerError, untilPublished } from "@/server/client";
import { handle, problem } from "@/server/problem";
import { taskRequest } from "@/server/request";
import { boundLabels, titleOf, toTask } from "@/server/task";
import { LABELS } from "@/shared/task";
import { type Handled, member } from "../-guards";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
// A git ref name: no whitespace, no control characters, none of ~ ^ : ? * [ \
const REF = /^[^\s~^:?*[\\\p{Cc}]{1,255}$/u;

const createBody = z.object({
  taskId: z.string().regex(ULID, "taskId must be a ULID"),
  repo: z.string().regex(REPO, "repo must be owner/name"),
  ref: z.string().regex(REF, "ref must be a branch, tag or commit"),
  text: z
    .string()
    .trim()
    .min(1)
    .max(32 * 1024),
});

export const Route = createFileRoute("/api/tasks")({
  server: {
    middleware: [member],
    handlers: {
      GET: handle(async ({ request, context }: Handled) => {
        const { config: settings, client: oc, now } = context;
        const search = new URL(request.url).searchParams;
        const archived = search.get("archived") === "true";
        const cursor = search.get("cursor");
        // Active is everything not archived, including sessions created
        // outside the app that carry no labels, so it cannot be one equality
        // filter: archived rows are dropped from an active page and the page
        // may be short. Archived is the label filter. One call per page.
        const page = await oc.sessions.list({
          project: settings.oc.projectId,
          environment: settings.oc.environment,
          agent: settings.oc.agentId,
          ...(archived ? { labels: { [LABELS.archived]: "true" } } : {}),
          ...(cursor ? { cursor } : {}),
        });
        const rows = archived ? page.sessions : page.sessions.filter((row) => row.labels?.[LABELS.archived] !== "true");
        return Response.json({ tasks: rows.map((row) => toTask(row, now())), nextCursor: page.nextCursor });
      }),
      POST: handle(async ({ request, context }: Handled) => {
        const { config: settings, client: oc } = context;
        const parsed = createBody.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
          return problem(400, "invalid_task", parsed.error.issues[0]?.message ?? "Invalid task");
        }
        const { taskId, repo, ref, text } = parsed.data;
        const actor = context.member.identity;

        const labels = boundLabels({
          [LABELS.request]: taskId,
          [LABELS.title]: titleOf(text),
          [LABELS.repo]: repo,
          [LABELS.ref]: ref,
          [LABELS.actorId]: String(actor.id),
          [LABELS.actorLogin]: actor.login,
          [LABELS.archived]: "false",
        });

        // Two calls, one key each, both addressed to the configured agent
        // and environment: which deployment runs the session is the
        // platform's choice, recorded on the session, and a retry under the
        // same key gets that session back even after a redeploy. A 200 on
        // the first call is the same session; the second deduplicates by
        // key. A conflict from either is shown, never repaired through the
        // request label.
        let created: Awaited<ReturnType<typeof oc.sessions.create>>;
        try {
          created = await untilPublished(() =>
            oc.sessions.create(
              { agentId: `${settings.oc.agentId}@${settings.oc.environment}`, labels, source: "api" },
              { idempotencyKey: taskId },
            ),
          );
        } catch (cause) {
          if (cause instanceof OpenComputerError && cause.code === "deployment_not_found") {
            return problem(
              409,
              "agent_not_deployed",
              `The agent is not deployed to ${settings.oc.environment} in this project.`,
            );
          }
          throw cause;
        }
        const receipt = await oc.sessions.turns.send(created.session.id, {
          ...taskRequest({ taskId, repo, ref, text, actor }),
          idempotencyKey: `${taskId}/start`,
          mode: "queue",
        });
        // The caller navigates to the task page, which loads the task; there
        // is nothing to read back here.
        return Response.json({ id: created.session.id, receipt }, { status: 201 });
      }),
    },
  },
});
