// The import rule that keeps the seam deliberate: the server side (the
// server modules and the server routes) imports the shared seam and itself;
// the client side (the browser's modules, the components and the screens)
// imports the shared seam and itself; neither reaches into the other. The
// shared seam imports only packages and the agent's schema.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".gen.ts") ? [path] : [];
  });
}

/** The app-internal targets a file imports, as `@/...` or relative paths resolved against src. */
function imports(path: string): string[] {
  const source = readFileSync(path, "utf8");
  const targets: string[] = [];
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = match[1] ?? "";
    if (spec.startsWith("@/")) targets.push(spec.slice(2));
    else if (spec.startsWith(".")) targets.push(relative(ROOT, join(path, "..", spec)).replace(/^\.\.\//, "../"));
  }
  return targets.map((target) => target.replace(/\?.*$/, ""));
}

type Side = "server" | "client" | "shared" | "entry";

function sideOf(file: string): Side {
  const rel = relative(ROOT, file);
  if (rel.startsWith("shared/")) return "shared";
  if (rel.startsWith("server/") || rel.startsWith("routes/api/") || rel.startsWith("routes/auth/")) return "server";
  if (rel.startsWith("routes/-")) return "server";
  if (rel.startsWith("lib/") || rel.startsWith("components/") || rel.startsWith("routes/")) return "client";
  return "entry";
}

const ALLOWED: Record<Side, RegExp> = {
  server: /^(shared\/|server\/|routes\/-|routes\/api\/|routes\/auth\/)/,
  client: /^(shared\/|lib\/|components\/|routes\/|styles\.css|router)/,
  shared: /^(shared\/|\.\.\/opencomputer\/)/,
  entry: /^(router|routeTree|routes\/|server\/|shared\/)/,
};

describe("the seam between the server and the client", () => {
  it("lets each side import the shared seam and itself, and nothing across", () => {
    const violations: string[] = [];
    for (const file of files(ROOT)) {
      const side = sideOf(file);
      for (const target of imports(file)) {
        if (!ALLOWED[side].test(target)) violations.push(`${relative(ROOT, file)} → ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps the shared seam free of framework and runtime imports", () => {
    for (const file of files(join(ROOT, "shared"))) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/from "(react|@tanstack|@opencomputer\/sdk|@opencomputer\/react)/);
    }
  });
});
