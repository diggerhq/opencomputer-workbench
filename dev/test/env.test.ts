import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/server/env";
import { config, SOURCE } from "./helpers";

describe("readConfig", () => {
  it("names the missing key and nothing else", () => {
    const { OPENCOMPUTER_API_KEY: _omitted, ...rest } = SOURCE;
    expect(() => readConfig(rest)).toThrow("Missing configuration: OPENCOMPUTER_API_KEY");
    expect(() => readConfig({ ...SOURCE, WORKBENCH_ORIGIN: "  " })).toThrow("Missing configuration: WORKBENCH_ORIGIN");
  });

  it("rejects an unknown environment and a short cookie key", () => {
    expect(() => config({ OPENCOMPUTER_ENVIRONMENT: "staging" })).toThrow("OPENCOMPUTER_ENVIRONMENT");
    expect(() => config({ WORKBENCH_COOKIE_KEY: Buffer.alloc(16).toString("base64") })).toThrow("32 bytes");
    expect(() => config({ WORKBENCH_COOKIE_KEY: "***" })).toThrow("base64");
  });

  it("normalizes origins and defaults the OpenComputer origin", () => {
    const parsed = config({ WORKBENCH_ORIGIN: "https://Workbench.Example/" });
    expect(parsed.origin).toBe("https://workbench.example");
    expect(parsed.oc.origin).toBe("https://app.opencomputer.dev");
    expect(() => config({ WORKBENCH_ORIGIN: "https://x.example/app" })).toThrow("origin without a path");
    expect(() => config({ OPENCOMPUTER_API_URL: "not a url" })).toThrow("OPENCOMPUTER_API_URL");
  });

  it("parses the membership policy", () => {
    expect(config().membership).toEqual({ kind: "team", orgId: 100, teamId: 200 });
    expect(config({ WORKBENCH_MEMBERSHIP: "org:5" }).membership).toEqual({ kind: "org", orgId: 5 });
    expect(config({ WORKBENCH_MEMBERSHIP: "user:9" }).membership).toEqual({ kind: "user", userId: 9 });
    expect(() => config({ WORKBENCH_MEMBERSHIP: "team:acme/platform" })).toThrow("numeric GitHub id");
  });
});
