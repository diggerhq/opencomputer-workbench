import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Activity,
  type ActivityEvent,
  activeTurn,
  applyEvent,
  applyEvents,
  commandOf,
  commandOutcome,
  emptyActivity,
  latestResult,
} from "../src/app/reducer";

const DIR = new URL("../fixtures/logs/", import.meta.url);

function load(name: string): ActivityEvent[] {
  return JSON.parse(readFileSync(new URL(`${name}.json`, DIR), "utf8")) as ActivityEvent[];
}

function reduce(name: string): Activity {
  return applyEvents(emptyActivity(), load(name));
}

const FIXTURES = readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

describe("the log reducer", () => {
  it("reads every fixture as a well-formed log", () => {
    expect(FIXTURES.length).toBe(8);
    for (const name of FIXTURES) {
      const events = load(name);
      expect(events[0]?.type).toBe("session.created");
      for (const [index, event] of events.entries()) expect(event.seq).toBe(index + 1);
    }
  });

  it("replay equals live: whole log, one event at a time, and in pages", () => {
    for (const name of FIXTURES) {
      const events = load(name);
      const whole = applyEvents(emptyActivity(), events);
      const oneByOne = events.reduce((state, event) => applyEvent(state, event), emptyActivity());
      let paged = emptyActivity();
      for (let start = 0; start < events.length; start += 3) paged = applyEvents(paged, events.slice(start, start + 3));
      let full = emptyActivity();
      for (let start = 0; start < events.length; start += 500)
        full = applyEvents(full, events.slice(start, start + 500));
      expect(oneByOne).toEqual(whole);
      expect(paged).toEqual(whole);
      expect(full).toEqual(whole);
    }
  });

  it("ignores events at or below the cursor, so an overlapping page changes nothing", () => {
    const events = load("completed");
    const whole = applyEvents(emptyActivity(), events);
    expect(applyEvents(whole, events)).toBe(whole);
    expect(applyEvents(whole, events.slice(0, 10))).toBe(whole);
  });

  it("shows a session with no turn as empty", () => {
    const activity = reduce("created-only");
    expect(activity.turns).toEqual([]);
    expect(activity.status).toBe("idle");
    expect(activity.createdAt).toBe("2026-09-15T20:41:07.000Z");
    expect(activity.ended).toBe(false);
    expect(latestResult(activity)).toBeUndefined();
  });

  it("keeps tool calls keyed by callId with their status and a streaming reply while working", () => {
    const activity = reduce("working");
    const [turn] = activity.turns;
    expect(turn?.status).toBe("running");
    expect(activeTurn(activity)?.id).toBe(turn?.id);
    expect(turn?.toolCalls.map((call) => [call.callId, call.status])).toEqual([
      ["toolu_01clone", "completed"],
      ["toolu_02ci", "completed"],
      ["toolu_03lint", "completed"],
      ["toolu_04test", "running"],
    ]);
    const lint = turn?.toolCalls[2];
    expect(lint && commandOutcome(lint)).toMatchObject({ kind: "error", exitCode: 1, durationMs: 1100 });
    expect(lint && commandOf(lint)).toBe("npm run lint");
    const ci = turn?.toolCalls[1];
    expect(ci && commandOutcome(ci).lines).toBe(142);
    expect(turn?.messages.at(-1)).toMatchObject({ role: "assistant", streaming: true });
    expect(turn?.messages.at(-1)?.text).toContain("running the tests");
  });

  it("commits the result from the result tool with its turn, and settles the reply", () => {
    const activity = reduce("completed");
    expect(activity.turns.map((turn) => turn.status)).toEqual(["completed", "queued"]);
    const result = latestResult(activity);
    expect(result?.stage).toBe("published");
    expect(result?.turnNumber).toBe(1);
    expect(result?.fromLastTurn).toBe(true);
    expect(result?.report.pr).toEqual({ number: 482, url: "https://github.com/acme/service/pull/482", draft: true });
    expect(activity.turns[0]?.resultCallId).toBe("toolu_06report");
    expect(activity.turns[0]?.toolCalls.find((call) => call.result)?.tool).toBe("report");
    expect(activity.turns[0]?.messages.at(-1)).toMatchObject({ role: "assistant", streaming: false });
    expect(activity.turns[1]?.input).toContain("CHANGELOG");
  });

  it("marks a turn failed with its public code and settles the open call", () => {
    const activity = reduce("turn-failed-runtime-lost");
    const [turn] = activity.turns;
    expect(turn?.status).toBe("failed");
    expect(turn?.failure).toEqual({
      code: "runtime_lost",
      message: "The runtime stopped responding and the turn was abandoned",
    });
    expect(turn?.toolCalls.at(-1)).toMatchObject({ callId: "toolu_02ci", status: "failed" });
    expect(activeTurn(activity)).toBeUndefined();
  });

  it("settles an interrupted turn as cancelled and lets the next one complete", () => {
    const activity = reduce("cancelled");
    expect(activity.turns.map((turn) => [turn.status, turn.cancelReason])).toEqual([
      ["cancelled", "interrupted"],
      ["completed", undefined],
    ]);
    expect(activity.turns[0]?.toolCalls.at(-1)?.status).toBe("failed");
    expect(activity.turns[0]?.messages.at(-1)?.streaming).toBe(false);
  });

  it("treats a timed-out command as a completed call inside a turn that went on", () => {
    const activity = reduce("tool-timed-out");
    const [turn] = activity.turns;
    expect(turn?.status).toBe("completed");
    const e2e = turn?.toolCalls.find((call) => call.callId === "toolu_03e2e");
    expect(e2e?.status).toBe("completed");
    expect(e2e && commandOutcome(e2e)).toMatchObject({ kind: "timed_out", exitCode: 137, durationMs: 120000 });
    const last = turn?.toolCalls.at(-1);
    expect(last && commandOutcome(last).kind).toBe("ok");
  });

  it("keeps a failed tool call in the turn and takes the later report as the result", () => {
    const activity = reduce("tool-failed");
    const [turn] = activity.turns;
    expect(turn?.status).toBe("completed");
    expect(turn?.toolCalls.map((call) => [call.callId, call.status])).toEqual([
      ["toolu_01clone", "completed"],
      ["toolu_02report", "failed"],
      ["toolu_03report", "completed"],
    ]);
    expect(turn?.toolCalls[1]?.message).toContain("is not in acme/service");
    expect(latestResult(activity)).toMatchObject({ stage: "base", turnNumber: 1 });
  });

  it("marks the session ended and keeps the result", () => {
    const activity = reduce("ended");
    expect(activity.ended).toBe(true);
    expect(activity.status).toBe("ended");
    expect(latestResult(activity)?.stage).toBe("base");
  });

  it("leaves no result when the result tool's output does not fit the schema", () => {
    const events = load("completed");
    const report = events.find((event) => event.type === "tool.completed" && event.data?.result === true);
    if (!report) throw new Error("fixture has no result call");
    const broken = events.map((event) =>
      event === report ? { ...event, data: { ...event.data, output: { commit: "abc123" } } } : event,
    );
    const activity = applyEvents(emptyActivity(), broken);
    expect(latestResult(activity)).toBeUndefined();
    expect(activity.turns[0]?.toolCalls.find((call) => call.callId === "toolu_06report")?.status).toBe("completed");
  });

  it("reports provenance when a later turn settled without a new result", () => {
    const events = load("completed");
    const turn2 = events.find((event) => event.type === "turn.queued")?.turnId;
    const last = events.at(-1)?.seq ?? 0;
    const more: ActivityEvent[] = [
      { seq: last + 1, timestamp: "2026-09-15T20:50:00.000Z", turnId: turn2, type: "turn.started", data: {} },
      {
        seq: last + 2,
        timestamp: "2026-09-15T20:50:05.000Z",
        turnId: turn2,
        type: "message.completed",
        data: { text: "Done." },
      },
      { seq: last + 3, timestamp: "2026-09-15T20:50:05.100Z", turnId: turn2, type: "turn.completed", data: {} },
    ];
    const activity = applyEvents(emptyActivity(), [...events, ...more]);
    const result = latestResult(activity);
    expect(result?.turnNumber).toBe(1);
    expect(result?.fromLastTurn).toBe(false);
  });

  it("keys a call without a callId by its sequence and matches completion by tool", () => {
    const activity = applyEvents(emptyActivity(), [
      { seq: 1, type: "session.created", data: { agentId: "worker", deploymentId: "dep" } },
      { seq: 2, turnId: "t1", type: "message.received", data: { input: "hi", mode: "queue" } },
      { seq: 3, turnId: "t1", type: "turn.started", data: {} },
      { seq: 4, turnId: "t1", type: "tool.started", data: { tool: "shell", title: "ls" } },
      { seq: 5, turnId: "t1", type: "tool.completed", data: { tool: "shell", title: "ls", output: "a\nb\n" } },
    ]);
    const call = activity.turns[0]?.toolCalls[0];
    expect(call?.callId).toBe("tool:4");
    expect(call?.status).toBe("completed");
    expect(call && commandOutcome(call)).toMatchObject({ kind: "ok", lines: 2 });
  });
});
