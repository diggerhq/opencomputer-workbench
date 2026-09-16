import { readdirSync, readFileSync } from "node:fs";
import type { AgentEvent } from "@opencomputer/react";
import { describe, expect, it } from "vitest";
import { emptyNotes, noteEvent, noteEvents } from "../../src/lib/activity-notes";

const LOGS = new URL("../fixtures/logs/", import.meta.url);

function load(name: string): AgentEvent[] {
  return JSON.parse(readFileSync(new URL(`${name}.json`, LOGS), "utf8")) as AgentEvent[];
}

describe("the notes taken beside the hook's turns", () => {
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
});
