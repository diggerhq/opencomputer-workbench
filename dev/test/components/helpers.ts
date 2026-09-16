import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AgentEvent, applyEvents, emptyTimeline, turnsOf } from "@opencomputer/react";
import { type Activity, activityOf, emptyNotes, noteEvents } from "../../../src/app/activity";

type ActivityEvent = AgentEvent & { sessionId?: string };

// Resolved with node:path: under happy-dom `URL` is the browser's class,
// which readFileSync does not accept.
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "logs");

export function load(name: string): ActivityEvent[] {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as ActivityEvent[];
}

export function reduce(name: string): Activity {
  const events = load(name);
  return activityOf(turnsOf(applyEvents(emptyTimeline(), events)), noteEvents(emptyNotes(), events));
}
