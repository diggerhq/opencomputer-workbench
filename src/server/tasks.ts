// The task routes: one page of the list, one task, create with the
// submission envelope, the two label edits and end. Every session-scoped
// route checks the session's scope before anything else; the create handler
// is the whole of "start work safely from a stateless handler".
import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "./env";
import { type Deployment, type OC, OCError, type SessionSummary } from "./oc";
import { problem } from "./problem";
import { taskRequest } from "./request";
import type { Variables } from "./routes";
import { workbenchSession } from "./scope";
import { boundLabels, LABEL_BOUNDS, LABELS, summarize, type Task, titleOf, toTask } from "./task";

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

const patchBody = z
  .object({
    title: z.string().trim().min(1).max(LABEL_BOUNDS.valueLength).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.archived !== undefined, "Nothing to change");

export interface Clock {
  now(): number;
}

export function taskRoutes(config: Config, oc: OC, clock: Clock): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  const scope = { project: config.oc.projectId, environment: config.oc.environment, agent: config.oc.agentId };
  const task = (row: SessionSummary): Task => toTask(row, clock.now());
  const fromSession = async (id: string): Promise<Task> =>
    task(summarize(await workbenchSession(oc, config, id), config.oc.projectId));

  app.get("/api/tasks", async (c) => {
    const archived = c.req.query("archived") === "true";
    const cursor = c.req.query("cursor") || null;
    // Active is everything not archived, including sessions created outside
    // the app that carry no labels, so it cannot be one equality filter:
    // archived rows are dropped from an active page and the page may be
    // short. Archived is the label filter. One OC call per page either way.
    const page = await oc.sessions.list({
      ...scope,
      ...(archived ? { labels: { [LABELS.archived]: "true" } } : {}),
      cursor,
    });
    const rows = archived ? page.sessions : page.sessions.filter((row) => row.labels[LABELS.archived] !== "true");
    return c.json({ tasks: rows.map(task), nextCursor: page.nextCursor });
  });

  app.get("/api/tasks/:id", async (c) => c.json({ task: await fromSession(c.req.param("id")) }));

  app.post("/api/tasks", async (c) => {
    const parsed = createBody.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      return problem(c, 400, "invalid_task", parsed.error.issues[0]?.message ?? "Invalid task");
    }
    const { taskId, deploymentId, repo, ref, text } = parsed.data;
    const actor = c.get("identity");

    // The composer pinned the deployment when it opened; the server checks
    // that it belongs to this workbench's agent and never resolves the alias
    // here, so a retry after the alias moved still carries the original.
    // Whether it is promoted to the environment is OpenComputer's check
    // (409 deployment_not_promoted), forwarded as it comes.
    let deployment: Deployment;
    try {
      deployment = await oc.deployments.get(deploymentId);
    } catch (cause) {
      if (cause instanceof OCError && cause.status === 404) {
        return problem(c, 409, "deployment_mismatch", "The pinned deployment is not this workbench's agent's.");
      }
      throw cause;
    }
    if (deployment.agentId !== config.oc.agentId) {
      return problem(c, 409, "deployment_mismatch", "The pinned deployment is not this workbench's agent's.");
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

    // Two calls, one key each. A 200 on the first is the same session; the
    // second deduplicates by key. A conflict from either is shown, never
    // repaired through the request label.
    const created = await oc.sessions.create(
      { deploymentId, environment: config.oc.environment, labels, source: "api" },
      taskId,
    );
    const receipt = await oc.turns.send(created.id, {
      ...taskRequest({ taskId, repo, ref, text, actor }, config.devStubs),
      idempotencyKey: `${taskId}/start`,
      mode: "queue",
    });
    const row: SessionSummary = {
      id: created.id,
      projectId: config.oc.projectId,
      agentId: config.oc.agentId,
      deploymentId,
      environment: config.oc.environment,
      source: "api",
      status: created.status,
      labels,
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
      revision: 0,
      activity: {
        activeTurnId: receipt.status === "running" ? receipt.turnId : null,
        queued: receipt.status === "queued" ? 1 : 0,
        lastSettledTurn: null,
      },
      result: null,
    };
    return c.json({ task: task(row), receipt }, 201);
  });

  app.patch("/api/tasks/:id", async (c) => {
    const parsed = patchBody.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      return problem(c, 400, "invalid_patch", parsed.error.issues[0]?.message ?? "Invalid change");
    }
    const id = c.req.param("id");
    await workbenchSession(oc, config, id);
    const set = boundLabels({
      ...(parsed.data.title !== undefined ? { [LABELS.title]: parsed.data.title } : {}),
      ...(parsed.data.archived !== undefined ? { [LABELS.archived]: parsed.data.archived ? "true" : "false" } : {}),
    });
    const session = await oc.sessions.setLabels(id, { set });
    return c.json({ task: task(summarize(session, config.oc.projectId)) });
  });

  app.post("/api/tasks/:id/end", async (c) => {
    const id = c.req.param("id");
    await workbenchSession(oc, config, id);
    const session = await oc.sessions.end(id);
    return c.json({ task: task(summarize(session, config.oc.projectId)) });
  });

  app.get("/api/repos", async (c) => {
    // DEV STUB (C3): the configured list, only with WORKBENCH_DEV_STUBS=1;
    // deleted with the stub when the repositories route ships.
    if (config.devStubs && config.devRepos) {
      return c.json({ repositories: config.devRepos.map((repo) => ({ ...repo, private: false })), nextCursor: null });
    }
    const page = await oc.github.repositories(config.oc.environment, c.req.query("cursor") || null);
    return c.json({
      repositories: page.repositories
        .filter((repo) => !repo.archived)
        .map(({ fullName, defaultBranch, private: isPrivate }) => ({ fullName, defaultBranch, private: isPrivate })),
      nextCursor: page.nextCursor,
    });
  });

  return app;
}
