import { describe, expect, it } from "vitest";
import { admit, parsePolicy, policyId } from "../src/server/membership";
import { fakeFetch, json } from "./helpers";

describe("parsePolicy", () => {
  it("round-trips through policyId", () => {
    for (const value of ["org:1", "team:1/2", "user:3"]) expect(policyId(parsePolicy(value))).toBe(value);
  });
  it("rejects other shapes", () => {
    expect(() => parsePolicy("all")).toThrow("WORKBENCH_MEMBERSHIP");
    expect(() => parsePolicy("team:1")).toThrow("team id");
    expect(() => parsePolicy("org:0")).toThrow("numeric");
  });
});

describe("admit", () => {
  it("admits an active organization member and names the organization", async () => {
    const fetch = fakeFetch({
      "https://api.github.com/user/memberships/orgs": () =>
        json([
          { state: "pending", organization: { id: 1, login: "other" } },
          { state: "active", organization: { id: 100, login: "acme" } },
        ]),
    });
    expect(await admit("t", parsePolicy("org:100"), fetch)).toEqual({ ok: true, display: "acme" });
    expect(await admit("t", parsePolicy("org:1"), fetch)).toEqual({ ok: false });
  });

  it("admits a team member only for the pinned organization", async () => {
    const fetch = fakeFetch({
      "https://api.github.com/user/teams": () =>
        json([{ id: 200, slug: "platform", name: "Platform", organization: { id: 100, login: "acme" } }]),
    });
    expect(await admit("t", parsePolicy("team:100/200"), fetch)).toEqual({ ok: true, display: "acme/platform" });
    expect(await admit("t", parsePolicy("team:101/200"), fetch)).toEqual({ ok: false });
  });

  it("admits a single user by id and treats a revoked token as not admitted", async () => {
    const fetch = fakeFetch({ "https://api.github.com/user": () => json({ id: 7, login: "me" }) });
    expect(await admit("t", parsePolicy("user:7"), fetch)).toEqual({ ok: true, display: "me" });
    expect(await admit("t", parsePolicy("user:8"), fetch)).toEqual({ ok: false });
    const revoked = fakeFetch({ "https://api.github.com/user": () => json({ message: "Bad credentials" }, 401) });
    expect(await admit("t", parsePolicy("user:7"), revoked)).toEqual({ ok: false });
  });

  it("follows pages until a short one", async () => {
    const page = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: offset + i + 1,
        slug: `t${String(i)}`,
        organization: { id: 100, login: "acme" },
      }));
    const fetch = fakeFetch({
      "https://api.github.com/user/teams": (url) =>
        json(url.searchParams.get("page") === "1" ? page(100, 0) : page(5, 100)),
    });
    expect(await admit("t", parsePolicy("team:100/103"), fetch)).toEqual({ ok: true, display: "acme/t2" });
    expect(fetch.calls).toHaveLength(2);
  });

  it("raises on an outage rather than admitting or denying", async () => {
    const fetch = fakeFetch({ "https://api.github.com/user": () => json({}, 503) });
    await expect(admit("t", parsePolicy("user:7"), fetch)).rejects.toThrow("503");
  });
});
