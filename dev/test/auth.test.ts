import { afterEach, describe, expect, it, vi } from "vitest";
import { callback, identity, login, open, SESSION_COOKIE, type SessionClaims, seal } from "../../src/server/auth";
import { config, fakeFetch, GITHUB_MEMBER, json } from "./helpers";

const T0 = Date.UTC(2026, 8, 15, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function claims(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    uid: 1,
    login: "octocat",
    avatar: "https://avatars.githubusercontent.com/u/1",
    ws: { policy: "team:100/200", display: "acme/platform", project: "proj_1", environment: "development" },
    checkedAt: T0,
    token: "gho_token",
    exp: T0 + 24 * HOUR,
    ...overrides,
  };
}

async function request(value: string): Promise<Request> {
  return new Request("https://workbench.example/api/workspace", { headers: { cookie: `${SESSION_COOKIE}=${value}` } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the cookie", () => {
  it("seals and opens, keeping the absolute expiry", async () => {
    const cfg = config();
    const value = await seal(claims(), cfg);
    expect(value.split(".")).toHaveLength(5);
    const opened = await open(value, cfg, T0 + HOUR);
    expect(opened).toEqual(claims());
  });

  it("is rejected once expired, under another key, and for another workspace", async () => {
    const cfg = config();
    const value = await seal(claims(), cfg);
    expect(await open(value, cfg, T0 + 25 * HOUR)).toBeNull();
    expect(await open(value, config({ WORKBENCH_COOKIE_KEY: Buffer.alloc(32, 9).toString("base64") }), T0)).toBeNull();
    expect(await open(value, config({ OPENCOMPUTER_PROJECT_ID: "proj_2" }), T0)).toBeNull();
    expect(await open(value, config({ OPENCOMPUTER_ENVIRONMENT: "production" }), T0)).toBeNull();
    expect(await open(value, config({ WORKBENCH_MEMBERSHIP: "team:100/201" }), T0)).toBeNull();
    expect(await open("garbage", cfg, T0)).toBeNull();
  });
});

describe("identity", () => {
  it("answers from the cookie alone while the membership check is fresh", async () => {
    const cfg = config();
    const fetch = fakeFetch({});
    const found = await identity(await request(await seal(claims(), cfg)), cfg, { fetch, now: () => T0 + HOUR - 1 });
    expect(found?.identity).toEqual({
      id: 1,
      login: "octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
    });
    expect(found?.membership).toEqual({ kind: "team", display: "acme/platform" });
    expect(found?.setCookie).toBeUndefined();
    expect(fetch.calls).toHaveLength(0);
  });

  it("re-checks after an hour and rewrites the cookie with the same expiry", async () => {
    const cfg = config();
    const fetch = fakeFetch(GITHUB_MEMBER);
    const now = T0 + 2 * HOUR;
    const found = await identity(await request(await seal(claims(), cfg)), cfg, { fetch, now: () => now });
    expect(found?.setCookie).toMatch(
      new RegExp(`^${SESSION_COOKIE}=.+; Path=/; HttpOnly; SameSite=Lax; Max-Age=79200; Secure$`),
    );
    const renewed = await open(found?.setCookie?.split(";")[0]?.slice(SESSION_COOKIE.length + 1) ?? "", cfg, now);
    expect(renewed?.checkedAt).toBe(now);
    expect(renewed?.exp).toBe(T0 + 24 * HOUR);
    expect(fetch.calls.map((call) => new URL(call.url).pathname)).toEqual(["/user/teams"]);
  });

  it("never extends admission on a failed or revoked check", async () => {
    const cfg = config();
    const gone = fakeFetch({ "https://api.github.com/user/teams": () => json([]) });
    expect(
      await identity(await request(await seal(claims(), cfg)), cfg, { fetch: gone, now: () => T0 + 2 * HOUR }),
    ).toBeNull();
    const revoked = fakeFetch({ "https://api.github.com/user/teams": () => json({}, 401) });
    expect(
      await identity(await request(await seal(claims(), cfg)), cfg, { fetch: revoked, now: () => T0 + 2 * HOUR }),
    ).toBeNull();
  });

  it("is null without a cookie", async () => {
    expect(await identity(new Request("https://workbench.example/api/workspace"), config())).toBeNull();
  });
});

describe("login and callback", () => {
  it("redirects to GitHub with read:org and a state cookie", () => {
    const response = login(config());
    expect(response.status).toBe(302);
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("scope")).toBe("read:org");
    expect(url.searchParams.get("client_id")).toBe("client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://workbench.example/auth/callback");
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain(`wb_oauth_state=${state}; Path=/auth; HttpOnly`);
  });

  it("rejects a callback whose state does not match the cookie", async () => {
    const response = await callback(
      new Request("https://workbench.example/auth/callback?code=c&state=x", {
        headers: { cookie: "wb_oauth_state=y" },
      }),
      config(),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?error=invalid_state");
  });

  it("exchanges the code, checks membership and issues the cookie", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "https://github.com/login/oauth/access_token": () => json({ access_token: "gho_new", token_type: "bearer" }),
      }),
    );
    const cfg = config();
    const response = await callback(
      new Request("https://workbench.example/auth/callback?code=c&state=s", {
        headers: { cookie: "wb_oauth_state=s" },
      }),
      cfg,
      { fetch: fakeFetch(GITHUB_MEMBER), now: () => T0 },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toContain("wb_oauth_state=; Path=/auth");
    const session = cookies[1] ?? "";
    expect(session).toMatch(/^wb_session=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure$/);
    const opened = await open(session.split(";")[0]?.slice(SESSION_COOKIE.length + 1) ?? "", cfg, T0);
    expect(opened).toMatchObject({ uid: 1, login: "octocat", token: "gho_new", checkedAt: T0, exp: T0 + 24 * HOUR });
    expect(opened?.ws).toEqual({
      policy: "team:100/200",
      display: "acme/platform",
      project: "proj_1",
      environment: "development",
    });
  });

  it("turns a non-member away without a cookie", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "https://github.com/login/oauth/access_token": () => json({ access_token: "gho_new", token_type: "bearer" }),
      }),
    );
    const response = await callback(
      new Request("https://workbench.example/auth/callback?code=c&state=s", {
        headers: { cookie: "wb_oauth_state=s" },
      }),
      config(),
      { fetch: fakeFetch({ ...GITHUB_MEMBER, "https://api.github.com/user/teams": () => json([]) }), now: () => T0 },
    );
    expect(response.headers.get("location")).toBe("/?error=not_a_member");
    expect(response.headers.getSetCookie().some((value) => value.startsWith("wb_session="))).toBe(false);
  });
});
