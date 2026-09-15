import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Activity, type ActivityEvent, applyEvents, emptyActivity } from "../../src/app/reducer";

// Resolved with node:path: under happy-dom `URL` is the browser's class,
// which readFileSync does not accept.
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "logs");

export function load(name: string): ActivityEvent[] {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as ActivityEvent[];
}

export function reduce(name: string): Activity {
  return applyEvents(emptyActivity(), load(name));
}
