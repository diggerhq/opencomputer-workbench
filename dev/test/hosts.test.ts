import { describe, expect, it } from "vitest";
import workers from "../src/hosts/workers";
import { SOURCE } from "./helpers";

describe("host entries", () => {
  it("serve the same app on Workers", async () => {
    const response = await workers.fetch(new Request("https://workbench.example/api/workspace"), SOURCE);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });

  it("serve the same app on Vercel", async () => {
    Object.assign(process.env, SOURCE);
    const { default: handler } = await import("../api/index");
    const response = await handler(new Request("https://workbench.example/api/workspace"));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });

  it("fail at startup naming the missing key", () => {
    const { OPENCOMPUTER_AGENT_ID: _omitted, ...rest } = SOURCE;
    expect(() => workers.fetch(new Request("https://workbench.example/api/workspace"), rest)).toThrow(
      "Missing configuration: OPENCOMPUTER_AGENT_ID",
    );
  });
});
