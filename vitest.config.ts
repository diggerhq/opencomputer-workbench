import { defineConfig } from "vitest/config";

// Server-side unit tests only; they import src/server and the host entries
// directly and never start Vite, so this config stays independent of
// vite.config.ts and its plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
