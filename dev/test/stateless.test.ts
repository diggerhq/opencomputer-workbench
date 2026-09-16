import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The statelessness check the design calls mechanical: the Worker declares
// no persistence or queue binding. The client assets are attached by the
// build; anything that could carry state between requests is not declared.
function jsonc(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "")) as Record<string, unknown>;
}

describe("the Worker configuration", () => {
  it("declares no persistence, queue or schedule", () => {
    const wrangler = jsonc("wrangler.jsonc");
    for (const binding of [
      "kv_namespaces",
      "d1_databases",
      "r2_buckets",
      "queues",
      "durable_objects",
      "triggers",
      "hyperdrive",
      "vectorize",
      "analytics_engine_datasets",
      "workflows",
      "migrations",
      "vars",
    ]) {
      expect(wrangler, binding).not.toHaveProperty(binding);
    }
    expect(wrangler.main).toBe("src/server.ts");
    expect(wrangler.compatibility_flags).toEqual(["nodejs_compat"]);
  });
});
