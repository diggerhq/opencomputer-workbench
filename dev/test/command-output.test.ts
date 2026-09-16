import { readFileSync } from "node:fs";
import { type AgentEvent, applyEvents, emptyTimeline, turnsOf } from "@opencomputer/react";
import { describe, expect, it } from "vitest";
import { type Activity, activityOf } from "../../src/lib/activity";
import { emptyNotes, noteEvents } from "../../src/lib/activity-notes";
import { commandOutcome, parseOutput } from "../../src/lib/command-output";

const LOGS = new URL("../fixtures/logs/", import.meta.url);

function load(name: string): AgentEvent[] {
  return JSON.parse(readFileSync(new URL(`${name}.json`, LOGS), "utf8")) as AgentEvent[];
}

function reduce(events: readonly AgentEvent[]): Activity {
  return activityOf(turnsOf(applyEvents(emptyTimeline(), events)), noteEvents(emptyNotes(), events));
}

describe("a command's outcome", () => {
  it("treats a timed-out command as a completed call inside a turn that went on", () => {
    const activity = reduce(load("tool-timed-out"));
    const e2e = activity.turns[0]?.toolCalls.find((call) => call.callId === "toolu_03e2e");
    expect(e2e?.status).toBe("completed");
    expect(e2e && commandOutcome(e2e)).toMatchObject({ kind: "timed_out", exitCode: 137, durationMs: 120000 });
  });

  it("reads the runtime's JSON string as the command's record and leaves other output alone", () => {
    expect(parseOutput('{"stdout":"ok\\n","exitCode":0}')).toEqual({ stdout: "ok\n", exitCode: 0 });
    expect(parseOutput("plain text")).toBe("plain text");
    expect(parseOutput("{not json")).toBe("{not json");
    expect(parseOutput({ already: "an object" })).toEqual({ already: "an object" });
  });
});
