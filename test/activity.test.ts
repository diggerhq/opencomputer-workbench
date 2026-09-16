import { readdirSync, readFileSync } from "node:fs";
import { type AgentEvent, applyEvents, emptyTimeline, turnsOf } from "@opencomputer/react";
import { describe, expect, it } from "vitest";
import {
  type Activity,
  activeTurn,
  activityOf,
  commandOutcome,
  emptyNotes,
  latestResult,
  noteEvent,
  noteEvents,
} from "../src/app/activity";

const LOGS = new URL("../fixtures/logs/", import.meta.url);
const CONTEXT = {
  taskId: "01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
  repo: "acme/service",
  ref: "main",
  actor: { id: 1, login: "jdoe" },
};

function load(name: string): AgentEvent[] {
  return JSON.parse(readFileSync(new URL(`${name}.json`, LOGS), "utf8")) as AgentEvent[];
}

/** The hook's turns joined with the notes, the way the page sees them. */
function reduce(events: readonly AgentEvent[]): Activity {
  return activityOf(turnsOf(applyEvents(emptyTimeline(), events)), noteEvents(emptyNotes(), events));
}

describe("the activity the page shows", () => {
  it("reads every fixture as a well-formed log", () => {
    const names = readdirSync(LOGS).filter((file) => file.endsWith(".json"));
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const name of names) {
      const events = load(name.replace(/\.json$/, ""));
      for (const [index, event] of events.entries()) expect(event.seq).toBe(index + 1);
    }
  });

  it("notes replay equals live: whole log, one event at a time, and in pages", () => {
    for (const name of ["working", "completed", "cancelled", "ended"]) {
      const events = load(name);
      const whole = noteEvents(emptyNotes(), events);
      const oneByOne = events.reduce(noteEvent, emptyNotes());
      const paged = [events.slice(0, 5), events.slice(5, 12), events.slice(12)].reduce(noteEvents, emptyNotes());
      expect(oneByOne).toEqual(whole);
      expect(paged).toEqual(whole);
      // An overlapping page changes nothing.
      expect(noteEvents(whole, events.slice(3, 9))).toBe(whole);
    }
  });

  it("joins timestamps, the payload and the call notes onto the hook's turns", () => {
    const activity = reduce(load("working"));
    const [turn] = activity.turns;
    expect(turn?.status).toBe("running");
    expect(turn?.payload).toEqual(CONTEXT);
    expect(turn?.createdAt).toBeTruthy();
    expect(turn?.startedAt).toBeTruthy();
    expect(turn?.toolCalls.map((call) => call.callId)).toEqual([
      "toolu_01clone",
      "toolu_02ci",
      "toolu_03lint",
      "toolu_04test",
    ]);
    const lint = turn?.toolCalls[2];
    expect(lint?.status).toBe("completed");
    expect(lint && commandOutcome(lint)).toMatchObject({ kind: "error", exitCode: 1 });
    expect(turn?.toolCalls[3]?.status).toBe("running");
    expect(activeTurn(activity)?.id).toBe(turn?.id);
    expect(activity.status).toBe("running");
  });

  it("takes the result from the result tool's call, validated, with its provenance", () => {
    const activity = reduce(load("completed"));
    const result = latestResult(activity);
    expect(result?.turnNumber).toBe(1);
    expect(result?.stage).toBe("published");
    expect(result?.fromLastTurn).toBe(true);
    expect(result?.report.pr?.number).toBe(19);
    expect(result?.report.repo).toBe("diggerhq/opencomputer-workbench");
    // The recording: two report calls the verifier rejected (a branch not yet
    // pushed, then a mistyped sha), then the one that committed.
    const reports = activity.turns[0]?.toolCalls.filter((call) => call.tool === "report") ?? [];
    expect(reports.map((call) => [call.status, call.result === true])).toEqual([
      ["failed", false],
      ["failed", false],
      ["completed", true],
    ]);
    expect(activity.turns).toHaveLength(1);
  });

  it("carries a failed turn's code and what settled its open call", () => {
    const activity = reduce(load("turn-failed-runtime-lost"));
    const [turn] = activity.turns;
    expect(turn?.status).toBe("failed");
    expect(turn?.failure).toMatchObject({ code: "runtime_lost" });
    expect(turn?.toolCalls.at(-1)).toMatchObject({ callId: "toolu_02ci", status: "failed", settledBy: "turn.failed" });
    expect(turn?.settledAt).toBeTruthy();
    expect(latestResult(activity)).toBeUndefined();
  });

  it("carries how a stop settled and marks the stopped call cancelled", () => {
    const activity = reduce(load("cancelled"));
    expect(activity.turns.map((turn) => [turn.status, turn.cancelReason])).toEqual([
      ["cancelled", "interrupted"],
      ["completed", undefined],
    ]);
    expect(activity.turns[0]?.settlement).toEqual({ afterMs: 1180, operations: 1, computerTerminated: false });
    const stopped = activity.turns[0]?.toolCalls.at(-1);
    expect(stopped).toMatchObject({ status: "cancelled", settledBy: "turn.cancelled" });
    expect(stopped && commandOutcome(stopped).kind).toBe("cancelled");
  });

  it("treats a timed-out command as a completed call inside a turn that went on", () => {
    const activity = reduce(load("tool-timed-out"));
    const e2e = activity.turns[0]?.toolCalls.find((call) => call.callId === "toolu_03e2e");
    expect(e2e?.status).toBe("completed");
    expect(e2e && commandOutcome(e2e)).toMatchObject({ kind: "timed_out", exitCode: 137, durationMs: 120000 });
  });

  it("marks the session ended and keeps the result", () => {
    const activity = reduce(load("ended"));
    expect(activity.ended).toBe(true);
    expect(latestResult(activity)).toBeDefined();
  });

  it("leaves no result when the result tool's output does not fit the schema", () => {
    const events = load("completed").map((event) =>
      event.type === "tool.completed" && event.data.result === true
        ? { ...event, data: { ...event.data, output: { commit: "short" } } }
        : event,
    );
    expect(latestResult(reduce(events))).toBeUndefined();
  });
});
