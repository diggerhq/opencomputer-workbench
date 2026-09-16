// GET /api/tasks: one page of the list, one OpenComputer call, rows mapped
// by toTask. POST /api/tasks: start work safely from a stateless handler,
// two calls under the task id the composer minted.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient, type Deployment, OpenComputerError, untilPublished } from "@/server/client";
import { config, deps } from "@/server/env";
import { handle, problem } from "@/server/problem";
import { taskRequest } from "@/server/request";
import { workbenchSession } from "@/server/scope";
import { boundLabels, LABELS, summarize, titleOf, toTask } from "@/server/task";
import { type Handled, member } from "../-middleware";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
// A git ref name: no whitespace, no control characters, none of ~ ^ : ? * [ \
const REF = /^[^\s~^:?*[\\\p{Cc}]{1,255}$/u;

const createBody = z.object({
  taskId: z.string().regex(ULID, "taskId must be a ULID"),
  deploymentId: z.string().min(1).max(128),
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
      GET: handle(async ({ request }: Handled) => {
        const settings = config();
        const { fetch, now } = deps();
        const oc = createClient(settings, fetch);
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
        const settings = config();
        const { fetch, now } = deps();
        const oc = createClient(settings, fetch);
        const parsed = createBody.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
          return problem(400, "invalid_task", parsed.error.issues[0]?.message ?? "Invalid task");
        }
        const { taskId, deploymentId, repo, ref, text } = parsed.data;
        const actor = context.member.identity;

        // The composer pinned the deployment when it opened; the server
        // checks that it belongs to this workbench's agent and never resolves
        // the alias here, so a retry after the alias moved still carries the
        // original. Whether it is promoted to the environment is
        // OpenComputer's check (409 deployment_not_promoted), forwarded.
        let deployment: Deployment;
        try {
          deployment = await oc.deployments.get(deploymentId);
        } catch (cause) {
          if (cause instanceof OpenComputerError && cause.status === 404) {
            return problem(409, "deployment_mismatch", "The pinned deployment is not this workbench's agent's.");
          }
          throw cause;
        }
        if (deployment.agentId !== settings.oc.agentId) {
          return problem(409, "deployment_mismatch", "The pinned deployment is not this workbench's agent's.");
        }

        const labels = boundLabels({
          [LABELS.request]: taskId,
          [LABELS.title]: titleOf(text),
          [LABELS.repo]: repo,
          [LABELS.ref]: ref,
          [LABELS.actorId]: String(actor.id),
          [LABELS.actorLogin]: actor.login,
          [LABELS.archived]: "false",
        });

        // Two calls, one key each. A 200 on the first is the same session;
        // the second deduplicates by key. A conflict from either is shown,
        // never repaired through the request label.
        const created = await untilPublished(() =>
          oc.sessions.create(
            { deploymentId, environment: settings.oc.environment, labels, source: "api" },
            { idempotencyKey: taskId },
          ),
        );
        const receipt = await oc.sessions.turns.send(created.session.id, {
          ...taskRequest({ taskId, repo, ref, text, actor }),
          idempotencyKey: `${taskId}/start`,
          mode: "queue",
        });
        // The session is read back rather than assembled here: its row is
        // published before the create call returns, and a duplicate receipt
        // may name a turn that has already settled.
        const session = await workbenchSession(oc, settings, created.session.id);
        return Response.json(
          { task: toTask(summarize(session, settings.oc.projectId), now()), receipt },
          { status: 201 },
        );
      }),
    },
  },
});
