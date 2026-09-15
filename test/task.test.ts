import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { displayStateOf, needsAttention } from "../src/app/lib/display";
import type { Session, SessionSummary } from "../src/server/oc";
import { boundLabels, LabelError, summarize, titleOf, toTask } from "../src/server/task";
import { T0 } from "./member";

const ROWS = new URL("../fixtures/rows/", import.meta.url);

function row(name: string): SessionSummary {
  return JSON.parse(readFileSync(new URL(`${name}.json`, ROWS), "utf8")) as SessionSummary;
}

describe("toTask over the row fixtures", () => {
  const cases: Array<[string, Partial<ReturnType<typeof toTask>> & { display: string; attention?: boolean }]> = [
    ["starting", { execution: "starting", queued: 0, archived: false, display: "starting" }],
    ["not-started", { execution: "not_started", display: "not_started", attention: true }],
    ["queued", { execution: "queued", queued: 1, display: "queued" }],
    ["working", { execution: "working", queued: 0, display: "working" }],
    ["working-queued", { execution: "working", queued: 2, display: "working" }],
    ["stopping", { execution: "stopping", display: "stopping" }],
    ["idle", { execution: "idle", display: "idle" }],
    ["result-base", { execution: "idle", display: "idle" }],
    ["idle-old-result", { execution: "idle", display: "idle" }],
    ["ready-changes", { execution: "idle", display: "ready_for_review" }],
    ["ready-published", { execution: "idle", display: "ready_for_review" }],
    ["failed", { execution: "failed", failure: { code: "runtime_lost" }, display: "failed", attention: true }],
    ["archived", { execution: "working", archived: true, display: "archived" }],
    ["ended", { execution: "ended", display: "ended" }],
  ];

  it.each(cases)("%s", (name, expected) => {
    const { display, attention, ...facets } = expected;
    const task = toTask(row(name), T0);
    expect(task).toMatchObject(facets);
    expect(displayStateOf(task)).toBe(display);
    expect(needsAttention(task)).toBe(attention ?? false);
  });

  it("projects every fixture that is a row", () => {
    const names = readdirSync(ROWS)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(/\.json$/, ""));
    const rows = names.filter((name) => !["page-1", "page-2", "page-last", "empty", "error"].includes(name));
    expect(rows.length).toBe(cases.length);
    for (const name of rows) expect(() => toTask(row(name), T0)).not.toThrow();
  });

  it("keeps the result facet independent of execution, with its turn and stage", () => {
    const fresh = toTask(row("ready-published"), T0);
    expect(fresh.result).toMatchObject({
      turnId: "turn_10a",
      stage: "published",
      fromLastTurn: true,
      pr: { number: 482, draft: true },
      checks: [{ command: "npm test", passed: true }],
    });
    const old = toTask(row("idle-old-result"), T0);
    expect(old.result).toMatchObject({ turnId: "turn_8a", stage: "changes", fromLastTurn: false });
    const base = toTask(row("result-base"), T0);
    expect(base.result?.stage).toBe("base");
    expect(toTask(row("idle"), T0).result).toBeUndefined();
    // A result never disappears because a later turn runs or fails.
    expect(toTask(row("working-queued"), T0).result?.stage).toBe("changes");
  });

  it("turns starting into not started after two minutes", () => {
    const fresh = row("starting");
    expect(toTask(fresh, T0).execution).toBe("starting");
    expect(toTask(fresh, T0 + 3 * 60_000).execution).toBe("not_started");
  });

  it("reads the labels the app writes", () => {
    expect(toTask(row("ready-published"), T0)).toMatchObject({
      title: "Add rate limiting to the public API",
      repo: "acme/service",
      ref: "v2.1.0",
      actor: { id: 2, login: "mo" },
    });
    const bare = toTask({ ...row("idle"), labels: {} }, T0);
    expect(bare).toMatchObject({ title: "Untitled task", repo: "", ref: "", actor: { id: 0, login: "" } });
  });
});

describe("summarize", () => {
  const session: Session = {
    id: "ses_1",
    agentId: "worker",
    deploymentId: "dep_dev",
    environment: "development",
    status: "running",
    labels: { title: "T" },
    result: null,
    turns: [
      { id: "t1", status: "completed", createdAt: "2026-09-15T20:00:00Z", updatedAt: "2026-09-15T20:05:00Z" },
      { id: "t2", status: "failed", createdAt: "2026-09-15T20:06:00Z", updatedAt: "2026-09-15T20:07:00Z" },
      { id: "t3", status: "running", createdAt: "2026-09-15T20:08:00Z", updatedAt: "2026-09-15T20:08:00Z" },
      { id: "t4", status: "queued", createdAt: "2026-09-15T20:09:00Z", updatedAt: "2026-09-15T20:09:00Z" },
    ],
    createdAt: "2026-09-15T20:00:00Z",
    updatedAt: "2026-09-15T20:09:00Z",
  };

  it("derives activity from turns when the session carries none", () => {
    const row = summarize(session, "proj_1");
    expect(row.projectId).toBe("proj_1");
    expect(row.activity).toEqual({
      activeTurnId: "t3",
      queued: 1,
      lastSettledTurn: { id: "t2", status: "failed", at: "2026-09-15T20:07:00Z" },
    });
    expect(toTask(row, T0)).toMatchObject({ execution: "working", queued: 1 });
  });

  it("prefers the activity the session carries", () => {
    const activity = { activeTurnId: null, queued: 0, lastSettledTurn: null };
    expect(summarize({ ...session, activity, projectId: "proj_9" }, "proj_1").activity).toBe(activity);
    expect(summarize({ ...session, activity, projectId: "proj_9" }, "proj_1").projectId).toBe("proj_9");
  });
});

describe("labels", () => {
  it("bounds keys, values and count", () => {
    expect(boundLabels({ title: "ok" })).toEqual({ title: "ok" });
    expect(() => boundLabels({ Title: "x" })).toThrow(LabelError);
    expect(() => boundLabels({ title: "x".repeat(257) })).toThrow(LabelError);
    expect(() => boundLabels(Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${String(i)}`, "v"])))).toThrow(
      LabelError,
    );
  });

  it("takes the title from the first non-empty line, bounded", () => {
    expect(titleOf("\n\n  Rename billing  \nmore")).toBe("Rename billing");
    expect(titleOf("x".repeat(300))).toHaveLength(256);
    expect(titleOf("   ")).toBe("Untitled task");
  });
});
