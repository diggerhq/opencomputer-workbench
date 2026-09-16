import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import type { Session } from "../src/server/oc";
import { config, fakeFetch, json } from "./helpers";
import { memberHeaders, memberPost, OC, T0 } from "./member";

const cfg = config();
const TASK_ID = "01J9Y0C6R4V3M2K7Q8N5P1H9ZT";
const page1 = JSON.parse(readFileSync(new URL("../fixtures/rows/page-1.json", import.meta.url), "utf8")) as {
  sessions: unknown[];
};

function session(over: Partial<Session> = {}): Session {
  return {
    id: "ses_1",
    agentId: "worker",
    deploymentId: "dep_dev",
    environment: "development",
    status: "idle",
    labels: { title: "Investigate", repo: "acme/service", ref: "main", actor_id: "1", actor_login: "octocat" },
    result: null,
    turns: [{ id: "t1", status: "completed", createdAt: "2026-09-15T20:00:00Z", updatedAt: "2026-09-15T20:05:00Z" }],
    createdAt: "2026-09-15T20:00:00Z",
    updatedAt: "2026-09-15T20:05:00Z",
    ...over,
  };
}

const deployment = {
  [`${OC}/deployments/dep_dev`]: () => json({ id: "dep_dev", agentId: "worker", alias: "development" }),
};

const envelope = {
  taskId: TASK_ID,
  deploymentId: "dep_dev",
  repo: "acme/service",
  ref: "main",
  text: "Add a health endpoint\n\nGET /healthz.",
};

describe("GET /api/tasks", () => {
  it("lists one page filtered to the workbench and maps the rows", async () => {
    const fetch = fakeFetch({ [`${OC}/sessions?`]: () => json(page1) });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks?cursor=c_1", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tasks: Array<{ id: string; execution: string }>; nextCursor: string };
    expect(body.nextCursor).toBe("c_page2");
    expect(body.tasks.map((task) => task.execution)).toEqual(["working", "idle", "failed", "queued", "idle"]);
    const url = new URL(fetch.calls[0]?.url ?? "");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      project: "proj_1",
      environment: "development",
      agent: "worker",
      cursor: "c_1",
    });
  });

  it("filters archived rows by label and drops archived rows from the active page", async () => {
    const archived = JSON.parse(readFileSync(new URL("../fixtures/rows/archived.json", import.meta.url), "utf8"));
    const idle = JSON.parse(readFileSync(new URL("../fixtures/rows/idle.json", import.meta.url), "utf8"));
    const fetch = fakeFetch({ [`${OC}/sessions?`]: () => json({ sessions: [archived, idle], nextCursor: null }) });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const active = await app.fetch(
      new Request("https://workbench.example/api/tasks", { headers: await memberHeaders(cfg) }),
    );
    expect(((await active.json()) as { tasks: unknown[] }).tasks).toHaveLength(1);
    const archivedPage = await app.fetch(
      new Request("https://workbench.example/api/tasks?archived=true", { headers: await memberHeaders(cfg) }),
    );
    expect(((await archivedPage.json()) as { tasks: unknown[] }).tasks).toHaveLength(2);
    expect(new URL(fetch.calls[1]?.url ?? "").searchParams.get("label.archived")).toBe("true");
    expect(new URL(fetch.calls[0]?.url ?? "").searchParams.has("label.archived")).toBe(false);
  });
});

describe("GET /api/tasks/:id", () => {
  it("answers the task after the scope check, accepting an aliased agent id", async () => {
    const fetch = fakeFetch({ [`${OC}/sessions/ses_1`]: () => json(session({ agentId: "worker@development" })) });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).task).toMatchObject({ id: "ses_1", execution: "idle", title: "Investigate" });
  });

  it.each([
    ["another agent", session({ agentId: "other" })],
    ["another environment", session({ environment: "production" })],
    ["another project", session({ projectId: "proj_2" })],
  ])("hides a session of %s as not found", async (_, foreign) => {
    const app = createApp(cfg, { fetch: fakeFetch({ [`${OC}/sessions/ses_1`]: () => json(foreign) }), now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("hides a missing session the same way", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1`]: () => json({ error: { code: "session_not_found", message: "No such session." } }, 404),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/tasks", () => {
  /** The session as `GET /sessions/<id>` returns it once the first turn is admitted: the labels the create call sent, one queued turn. */
  function createdSession(over: Partial<Session> = {}): Session {
    return session({
      id: "ses_new",
      projectId: "proj_1",
      status: "idle",
      labels: {
        request: TASK_ID,
        title: "Add a health endpoint",
        repo: "acme/service",
        ref: "main",
        actor_id: "1",
        actor_login: "octocat",
        archived: "false",
      },
      turns: [{ id: "turn_1", status: "queued", createdAt: "2026-09-15T20:46:01Z", updatedAt: "2026-09-15T20:46:01Z" }],
      createdAt: "2026-09-15T20:46:00Z",
      updatedAt: "2026-09-15T20:46:01Z",
      ...over,
    });
  }

  function creating(overrides: Record<string, (url: URL, init?: RequestInit) => Response> = {}) {
    return fakeFetch({
      ...deployment,
      [`${OC}/sessions/ses_new/turns`]: () => json({ turnId: "turn_1", status: "queued", duplicate: false }, 202),
      [`${OC}/sessions/ses_new`]: () => json(createdSession()),
      [`${OC}/sessions`]: () =>
        json({ session: { id: "ses_new", status: "new", createdAt: "2026-09-15T20:46:00Z" }, deployment: {} }, 201),
      ...overrides,
    });
  }

  it("creates the session and admits the first turn under the task id, pinned to the composer's deployment", async () => {
    const fetch = creating();
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.receipt).toEqual({ turnId: "turn_1", status: "queued", duplicate: false });
    expect(body.task).toMatchObject({
      id: "ses_new",
      execution: "queued",
      queued: 1,
      title: "Add a health endpoint",
      repo: "acme/service",
      ref: "main",
      actor: { id: 1, login: "octocat" },
      archived: false,
    });
    const [, create, turn, readBack] = fetch.calls;
    expect(readBack?.url).toBe(`${OC}/sessions/ses_new`);
    expect(create?.init?.headers).toMatchObject({ "idempotency-key": TASK_ID });
    expect(JSON.parse(String(create?.init?.body))).toEqual({
      deploymentId: "dep_dev",
      environment: "development",
      source: "api",
      labels: {
        request: TASK_ID,
        title: "Add a health endpoint",
        repo: "acme/service",
        ref: "main",
        actor_id: "1",
        actor_login: "octocat",
        archived: "false",
      },
    });
    expect(JSON.parse(String(turn?.init?.body))).toEqual({
      input: envelope.text,
      payload: { taskId: TASK_ID, repo: "acme/service", ref: "main", actor: { id: 1, login: "octocat" } },
      idempotencyKey: `${TASK_ID}/start`,
      mode: "queue",
    });
  });

  it("folds the context into the text only under the development stub", async () => {
    const fetch = creating();
    const app = createApp(
      config({ WORKBENCH_DEV_STUBS: "1", WORKBENCH_DEV_REPOS: '[{"fullName":"acme/service","defaultBranch":"main"}]' }),
      {
        fetch,
        now: () => T0,
      },
    );
    await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    const turn = JSON.parse(String(fetch.calls[2]?.init?.body));
    expect(turn.payload).toBeUndefined();
    expect(turn.input).toBe(`[workbench] task=${TASK_ID} repo=acme/service ref=main actor=octocat\n${envelope.text}`);
  });

  it("continues to the turn when the key had already created the session", async () => {
    const fetch = creating({
      [`${OC}/sessions`]: () =>
        json({ session: { id: "ses_new", status: "new", createdAt: "2026-09-15T20:46:00Z" } }, 200),
      [`${OC}/sessions/ses_new/turns`]: () => json({ turnId: "turn_1", status: "queued", duplicate: true }, 200),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).receipt.duplicate).toBe(true);
  });

  it("reads the task back for a duplicate receipt whose turn has already settled", async () => {
    const fetch = creating({
      [`${OC}/sessions/ses_new/turns`]: () => json({ turnId: "turn_1", status: "completed", duplicate: true }, 200),
      [`${OC}/sessions/ses_new`]: () =>
        json(
          createdSession({
            turns: [
              {
                id: "turn_1",
                status: "completed",
                createdAt: "2026-09-15T20:46:01Z",
                updatedAt: "2026-09-15T20:50:00Z",
              },
            ],
          }),
        ),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.receipt).toEqual({ turnId: "turn_1", status: "completed", duplicate: true });
    expect(body.task).toMatchObject({ id: "ses_new", execution: "idle", queued: 0 });
  });

  it("repeats a create whose row was not confirmed in the list, then forwards the problem", async () => {
    let creates = 0;
    const fetch = creating({
      [`${OC}/sessions`]: () => {
        creates += 1;
        if (creates === 1) {
          return json(
            { error: { code: "session_publication_unconfirmed", message: "Not confirmed.", sessionId: "ses_new" } },
            503,
          );
        }
        return json({ session: { id: "ses_new", status: "new", createdAt: "2026-09-15T20:46:00Z" } }, 200);
      },
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(response.status).toBe(201);
    expect(creates).toBe(2);

    const always = creating({
      [`${OC}/sessions`]: () =>
        json(
          { error: { code: "session_publication_unconfirmed", message: "Not confirmed.", sessionId: "ses_new" } },
          503,
        ),
    });
    const stuck = await createApp(cfg, { fetch: always, now: () => T0 }).fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(stuck.status).toBe(503);
    expect((await stuck.json()).error.code).toBe("session_publication_unconfirmed");
    expect(always.calls.filter((call) => call.url === `${OC}/sessions`)).toHaveLength(3);
  });

  it("ends with one session and one turn when the envelope is retried after a lost reply", async () => {
    let turnCalls = 0;
    const fetch = creating({
      [`${OC}/sessions/ses_new/turns`]: () => {
        turnCalls += 1;
        if (turnCalls === 1) throw new Error("socket hang up");
        return json({ turnId: "turn_1", status: "queued", duplicate: true }, 200);
      },
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const send = async () =>
      app.fetch(
        new Request("https://workbench.example/api/tasks", {
          method: "POST",
          headers: await memberPost(cfg),
          body: JSON.stringify(envelope),
        }),
      );
    const first = await send();
    expect(first.status).toBe(500);
    const second = await send();
    expect(second.status).toBe(201);
    expect((await second.json()).receipt).toMatchObject({ turnId: "turn_1", duplicate: true });
    const creates = fetch.calls.filter((call) => call.url === `${OC}/sessions`);
    expect(creates).toHaveLength(2);
    const keys = creates.map((call) => (call.init?.headers as Record<string, string> | undefined)?.["idempotency-key"]);
    expect(new Set(keys)).toEqual(new Set([TASK_ID]));
  });

  it("forwards a conflict and a refusal with their status, and never repairs a conflict", async () => {
    const conflict = creating({
      [`${OC}/sessions`]: () => json({ error: { code: "idempotency_conflict", message: "Different inputs." } }, 409),
    });
    const app = createApp(cfg, { fetch: conflict, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("idempotency_conflict");
    expect(conflict.calls.some((call) => call.url.includes("/turns") || call.url.includes("label."))).toBe(false);

    const refused = creating({
      [`${OC}/sessions/ses_new/turns`]: () =>
        json({ error: { code: "insufficient_credits", message: "Out of credits." } }, 402),
    });
    const refusing = createApp(cfg, { fetch: refused, now: () => T0 });
    const answer = await refusing.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify(envelope),
      }),
    );
    expect(answer.status).toBe(402);
    expect((await answer.json()).error.code).toBe("insufficient_credits");
  });

  it("refuses a deployment that is not the workbench agent's without creating anything", async () => {
    const fetch = fakeFetch({
      [`${OC}/deployments/dep_x`]: () => json({ id: "dep_x", agentId: "other", alias: "development" }),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks", {
        method: "POST",
        headers: await memberPost(cfg),
        body: JSON.stringify({ ...envelope, deploymentId: "dep_x" }),
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("deployment_mismatch");
    expect(fetch.calls).toHaveLength(1);
  });

  it("validates the envelope", async () => {
    const app = createApp(cfg, { fetch: fakeFetch({}), now: () => T0 });
    for (const bad of [
      { ...envelope, taskId: "not-a-ulid" },
      { ...envelope, repo: "acme" },
      { ...envelope, ref: "bad ref" },
      { ...envelope, text: "   " },
    ]) {
      const response = await app.fetch(
        new Request("https://workbench.example/api/tasks", {
          method: "POST",
          headers: await memberPost(cfg),
          body: JSON.stringify(bad),
        }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("invalid_task");
    }
  });
});

describe("PATCH /api/tasks/:id and end", () => {
  it("writes the title and archived labels within bounds", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1/labels`]: (_, init) => {
        const change = JSON.parse(String(init?.body));
        return json(session({ labels: { ...session().labels, ...change.set } }));
      },
      [`${OC}/sessions/ses_1`]: () => json(session()),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", {
        method: "PATCH",
        headers: await memberPost(cfg),
        body: JSON.stringify({ title: "Renamed", archived: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).task).toMatchObject({ title: "Renamed", archived: true });
    expect(fetch.calls[1]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(fetch.calls[1]?.init?.body))).toEqual({ set: { title: "Renamed", archived: "true" } });
  });

  it("refuses a title over the label bound and an empty change", async () => {
    const app = createApp(cfg, { fetch: fakeFetch({}), now: () => T0 });
    const long = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", {
        method: "PATCH",
        headers: await memberPost(cfg),
        body: JSON.stringify({ title: "x".repeat(257) }),
      }),
    );
    expect(long.status).toBe(400);
    const empty = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1", {
        method: "PATCH",
        headers: await memberPost(cfg),
        body: "{}",
      }),
    );
    expect(empty.status).toBe(400);
  });

  it("ends the session after the scope check", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1/end`]: () => json(session({ status: "ended" })),
      [`${OC}/sessions/ses_1`]: () => json(session()),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/tasks/ses_1/end", { method: "POST", headers: await memberPost(cfg) }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).task.execution).toBe("ended");
  });
});

describe("GET /api/repos", () => {
  it("lists the connection's repositories for the environment, dropping archived ones", async () => {
    const fetch = fakeFetch({
      [`${OC}/projects/proj_1/github/repositories?environment=development`]: () =>
        json({
          repositories: [
            { id: 1, fullName: "acme/service", private: true, defaultBranch: "main", archived: false },
            { id: 2, fullName: "acme/old", private: false, defaultBranch: "master", archived: true },
          ],
          nextCursor: null,
        }),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/repos", { headers: await memberHeaders(cfg) }),
    );
    expect(await response.json()).toEqual({
      repositories: [{ fullName: "acme/service", defaultBranch: "main", private: true }],
      nextCursor: null,
    });
  });

  it("surfaces a missing route as the forwarded problem, never a fallback", async () => {
    const fetch = fakeFetch({
      [`${OC}/projects/proj_1/github/repositories`]: () =>
        json({ error: { code: "not_found", message: "No route." } }, 404),
    });
    const app = createApp(config({ WORKBENCH_DEV_REPOS: '[{"fullName":"acme/service","defaultBranch":"main"}]' }), {
      fetch,
      now: () => T0,
    });
    const response = await app.fetch(
      new Request("https://workbench.example/api/repos", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("forwards an environment without a GitHub installation as the API answers it", async () => {
    const fetch = fakeFetch({
      [`${OC}/projects/proj_1/github/repositories`]: () =>
        json({ error: { code: "github_connection_not_found", message: "No installation." } }, 404),
    });
    const response = await createApp(cfg, { fetch, now: () => T0 }).fetch(
      new Request("https://workbench.example/api/repos", { headers: await memberHeaders(cfg) }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("github_connection_not_found");
  });

  it("serves the configured list only under the development stub", async () => {
    const fetch = fakeFetch({});
    const stubbed = config({
      WORKBENCH_DEV_STUBS: "1",
      WORKBENCH_DEV_REPOS: '[{"fullName":"acme/service","defaultBranch":"main"}]',
    });
    const app = createApp(stubbed, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/repos", { headers: await memberHeaders(stubbed) }),
    );
    expect(await response.json()).toEqual({
      repositories: [{ fullName: "acme/service", defaultBranch: "main", private: false }],
      nextCursor: null,
    });
    expect(fetch.calls).toHaveLength(0);
    // The gate alone does not stub the route: without a configured list the
    // live repositories route is called, so the C2 stub can run by itself.
    expect(config({ WORKBENCH_DEV_STUBS: "1" }).devRepos).toBeUndefined();
    expect(() => config({ WORKBENCH_DEV_STUBS: "1", WORKBENCH_DEV_REPOS: "[]" })).toThrow(/WORKBENCH_DEV_REPOS/);
  });
});
