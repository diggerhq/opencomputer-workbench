import { describe, expect, it } from "vitest";
import { type Report, reportJsonSchema, reportSchema, reportStage } from "../opencomputer/agents/worker/tools/report";

const sha = "a".repeat(40);

describe("report schema", () => {
  it("accepts a complete report and a partial one", () => {
    const full: Report = {
      baseSha: sha,
      branch: "task/01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
      commit: "b".repeat(40),
      pr: { number: 482, url: "https://github.com/acme/service/pull/482", draft: true },
      checks: [{ command: "npm test", passed: true, summary: "41 passed" }],
    };
    expect(reportSchema.parse(full)).toEqual(full);
    expect(reportSchema.parse({ baseSha: sha })).toEqual({ baseSha: sha });
    expect(reportSchema.parse({})).toEqual({});
  });

  it("rejects short shas and unknown fields", () => {
    expect(reportSchema.safeParse({ commit: "abc123" }).success).toBe(false);
    expect(reportSchema.safeParse({ baseSha: sha, verified: true }).success).toBe(false);
    expect(reportSchema.safeParse({ pr: { number: 1, url: "https://x.test/1" } }).success).toBe(false);
  });

  it("derives the stage from the furthest field present", () => {
    expect(reportStage(undefined)).toBe("none");
    expect(reportStage({})).toBe("none");
    expect(reportStage({ baseSha: sha })).toBe("base");
    expect(reportStage({ baseSha: sha, branch: "task/x", commit: sha })).toBe("changes");
    expect(reportStage({ commit: sha, pr: { number: 1, url: "https://x.test/1", draft: false } })).toBe("published");
  });

  it("declares a JSON Schema object with the same properties", () => {
    expect(reportJsonSchema.type).toBe("object");
    expect(Object.keys(reportJsonSchema.properties as object).sort()).toEqual([
      "baseSha",
      "branch",
      "checks",
      "commit",
      "pr",
    ]);
    expect(reportJsonSchema.additionalProperties).toBe(false);
  });
});
