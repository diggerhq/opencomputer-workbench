import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { config, fakeFetch, json } from "./helpers";
import { memberHeaders, memberPost, OC, T0 } from "./member";

const cfg = config();
const own = {
  id: "ses_1",
  agentId: "worker",
  deploymentId: "dep_dev",
  environment: "development",
  status: "idle",
  turns: [],
  createdAt: "2026-09-15T20:00:00Z",
  updatedAt: "2026-09-15T20:00:00Z",
};

describe("the three proxied routes", () => {
  it("forwards the event log with its cursor after the scope check", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1/events`]: (url) =>
        json({ events: [{ seq: 1, type: "session.created", data: {} }], after: url.searchParams.get("after") }),
      [`${OC}/sessions/ses_1`]: () => json(own),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/events?after=41", {
        headers: await memberHeaders(cfg),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ events: [{ seq: 1, type: "session.created", data: {} }], after: "41" });
    expect(fetch.calls[1]?.url).toBe(`${OC}/sessions/ses_1/events?after=41`);
    expect(fetch.calls[1]?.init?.headers).toMatchObject({ "x-api-key": "test-key" });
  });

  it("forwards a turn body and the upstream answer unchanged", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1/turns`]: (_, init) =>
        json({ turnId: "t9", status: "queued", echoed: JSON.parse(String(init?.body)) }, 202),
      [`${OC}/sessions/ses_1`]: () => json(own),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const body = JSON.stringify({ input: "Continue", idempotencyKey: "k1" });
    const response = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/turns", {
        method: "POST",
        headers: await memberPost(cfg),
        body,
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      turnId: "t9",
      status: "queued",
      echoed: { input: "Continue", idempotencyKey: "k1" },
    });
  });

  it("forwards an interrupt and an upstream error as they come", async () => {
    const fetch = fakeFetch({
      [`${OC}/sessions/ses_1/interrupt`]: () => json({ error: { code: "session_ended", message: "Ended." } }, 409),
      [`${OC}/sessions/ses_1`]: () => json(own),
    });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/interrupt", {
        method: "POST",
        headers: await memberPost(cfg),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "session_ended", message: "Ended." } });
  });

  it("answers 404 for a foreign session before touching it", async () => {
    const fetch = fakeFetch({ [`${OC}/sessions/ses_1`]: () => json({ ...own, agentId: "other" }) });
    const app = createApp(cfg, { fetch, now: () => T0 });
    const response = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/events?after=0", {
        headers: await memberHeaders(cfg),
      }),
    );
    expect(response.status).toBe(404);
    expect(fetch.calls).toHaveLength(1);
  });

  it("proxies nothing else", async () => {
    const app = createApp(cfg, { fetch: fakeFetch({ [`${OC}/sessions/ses_1`]: () => json(own) }), now: () => T0 });
    const wrongMethod = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/events", {
        method: "POST",
        headers: await memberPost(cfg),
      }),
    );
    expect(wrongMethod.status).toBe(404);
    const unknown = await app.fetch(
      new Request("https://workbench.example/api/agent/sessions/ses_1/end", {
        method: "POST",
        headers: await memberPost(cfg),
      }),
    );
    expect(unknown.status).toBe(404);
    const signedOut = await app.fetch(new Request("https://workbench.example/api/agent/sessions/ses_1/events"));
    expect(signedOut.status).toBe(401);
  });
});
