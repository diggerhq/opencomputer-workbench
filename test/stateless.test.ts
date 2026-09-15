import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The statelessness check the design calls mechanical: the host
// configurations declare no persistence or queue binding. Static assets and
// secrets are fine; anything that could carry state between requests is not.
function jsonc(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "")) as Record<string, unknown>;
}

describe("the host configurations", () => {
  it("declare no persistence, queue or schedule on Workers", () => {
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
    ]) {
      expect(wrangler, binding).not.toHaveProperty(binding);
    }
    expect(wrangler.assets).toMatchObject({ directory: "dist/client", not_found_handling: "single-page-application" });
  });

  it("declare no schedule or storage on Vercel", () => {
    const vercel = jsonc("vercel.json");
    expect(vercel).not.toHaveProperty("crons");
    expect(vercel).not.toHaveProperty("env");
    expect(vercel.outputDirectory).toBe("dist/client");
  });
});
