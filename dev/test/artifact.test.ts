import { describe, expect, it } from "vitest";
import { Route as workspace } from "../../src/routes/api/workspace";
import server from "../../src/server";
import { configure } from "../../src/server/env";
import { serve } from "./serve";

describe("the one artifact", () => {
  it("exports the framework's request handler as the server entry", () => {
    expect(typeof server.fetch).toBe("function");
  });

  it("serves every server route as a route file with its handlers and guards", () => {
    expect(Object.keys(workspace.options.server?.handlers ?? {})).toEqual(["GET"]);
    expect(workspace.options.server?.middleware?.length).toBe(1);
  });

  it("answers a request with a problem naming the missing key instead of running misconfigured", async () => {
    const { OPENCOMPUTER_AGENT_ID: _omitted, ...rest } = process.env;
    const saved = process.env;
    process.env = rest as NodeJS.ProcessEnv;
    configure();
    try {
      const response = await serve(new Request("https://workbench.example/api/workspace"));
      expect(response.status).toBe(500);
      expect((await response.json()).error).toMatchObject({ code: "misconfigured" });
      expect(response.headers.get("content-type") ?? "").toContain("json");
    } finally {
      process.env = saved;
    }
  });
});
