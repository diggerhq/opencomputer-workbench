import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, type SessionClaims, seal } from "../../src/server/auth";
import { configure } from "../../src/server/env";
import { config, fakeFetch, GITHUB_MEMBER, json, PROJECT } from "./helpers";
import { serve } from "./serve";

const T0 = Date.UTC(2026, 8, 15, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const cfg = config();

const claims: SessionClaims = {
  uid: 1,
  login: "octocat",
  avatar: "",
  ws: { policy: "team:100/200", display: "acme/platform", project: "proj_1", environment: "development" },
  checkedAt: T0,
  token: "gho_token",
  exp: T0 + 24 * HOUR,
};

async function member(): Promise<Record<string, string>> {
  return { cookie: `${SESSION_COOKIE}=${await seal(claims, cfg)}` };
}

describe("the route table", () => {
  it("answers 401 with one problem shape and clears the cookie when nobody is signed in", async () => {
    configure({ config: cfg, fetch: fakeFetch({}), now: () => T0 });
    const response = await serve(new Request("https://workbench.example/api/workspace"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated", message: "Sign in to use the workbench." },
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
  });

  it("describes the workspace for a member", async () => {
    const fetch = fakeFetch(PROJECT);
    configure({ config: cfg, fetch, now: () => T0 });
    const response = await serve(new Request("https://workbench.example/api/workspace", { headers: await member() }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      identity: { id: 1, login: "octocat", avatarUrl: "" },
      deploymentId: "dep_dev",
      environment: "development",
      membership: { kind: "team", display: "acme/platform" },
    });
    expect(fetch.calls[0]?.init?.headers).toMatchObject({ "x-api-key": "test-key" });
  });

  it("reports an agent that is not deployed to the environment", async () => {
    configure({ config: config({ OPENCOMPUTER_ENVIRONMENT: "production" }), fetch: fakeFetch(PROJECT), now: () => T0 });
    const production = { ...claims, ws: { ...claims.ws, environment: "production" } };
    const response = await serve(
      new Request("https://workbench.example/api/workspace", {
        headers: {
          cookie: `${SESSION_COOKIE}=${await seal(production, config({ OPENCOMPUTER_ENVIRONMENT: "production" }))}`,
        },
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("agent_not_deployed");
  });

  it("forwards OpenComputer's error code and clears nothing", async () => {
    const fetch = fakeFetch({
      "https://app.opencomputer.dev/api/managed-agents/projects/proj_1": () =>
        json({ error: { code: "project_not_found", message: "No such project." } }, 404),
    });
    configure({ config: cfg, fetch, now: () => T0 });
    const response = await serve(new Request("https://workbench.example/api/workspace", { headers: await member() }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "project_not_found", message: "No such project." } });
  });

  it("rewrites the cookie on a route when membership was re-checked", async () => {
    configure({ config: cfg, fetch: fakeFetch({ ...PROJECT, ...GITHUB_MEMBER }), now: () => T0 + 2 * HOUR });
    const response = await serve(new Request("https://workbench.example/api/workspace", { headers: await member() }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/^wb_session=.+; Max-Age=79200; Secure$/);
  });

  it("requires the app's own origin on state-changing requests", async () => {
    configure({ config: cfg, fetch: fakeFetch({}), now: () => T0 });
    const foreign = await serve(
      new Request("https://workbench.example/auth/logout", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error.code).toBe("origin_mismatch");
    const missing = await serve(new Request("https://workbench.example/auth/logout", { method: "POST" }));
    expect(missing.status).toBe(403);
    const own = await serve(
      new Request("https://workbench.example/auth/logout", {
        method: "POST",
        headers: { origin: "https://workbench.example" },
      }),
    );
    expect(own.status).toBe(204);
    expect(own.headers.get("set-cookie")).toContain("Max-Age=0");
    const sameSite = await serve(
      new Request("https://workbench.example/auth/logout", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(sameSite.status).toBe(204);
  });

  it("answers unknown routes with the problem shape", async () => {
    configure({ config: cfg, fetch: fakeFetch({}), now: () => T0 });
    const response = await serve(new Request("https://workbench.example/api/nope", { headers: await member() }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });
});
