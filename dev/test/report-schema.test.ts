import { describe, expect, it } from "vitest";
import { parseReport, REPORT_JSON_SCHEMA, report } from "../../opencomputer/agents/worker/tools/report";
import { type Report, reportSchema, reportStage } from "../../src/lib/report";

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

  it("declares the same schema to the model that the app parses with", () => {
    expect(report.input).toBe(REPORT_JSON_SCHEMA);
    expect(report.output).toBe(REPORT_JSON_SCHEMA);
    expect((report as unknown as { result?: boolean }).result).toBe(true);
    expect(Object.keys(REPORT_JSON_SCHEMA.properties).sort()).toEqual([
      "baseSha",
      "branch",
      "checks",
      "commit",
      "pr",
      "repo",
    ]);
  });

  it("checks the model's input the way the app's parser does", () => {
    const full: Report = {
      repo: "acme/service",
      baseSha: sha,
      branch: "task/01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
      commit: "b".repeat(40),
      pr: { number: 482, url: "https://github.com/acme/service/pull/482", draft: true },
      checks: [{ command: "npm test", passed: true, summary: "41 passed" }],
    };
    expect(parseReport(full)).toEqual(full);
    expect(reportSchema.parse(full)).toEqual(full);
    for (const bad of [
      { commit: "abc123" },
      { baseSha: sha, verified: true },
      { pr: { number: 1, url: "https://x.test/1" } },
      { repo: "not a repo" },
      { checks: [{ command: "", passed: true, summary: "" }] },
      "text",
    ]) {
      expect(() => parseReport(bad)).toThrow();
      expect(reportSchema.safeParse(bad).success).toBe(false);
    }
  });
});
