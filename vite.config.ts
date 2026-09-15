// One Vite project, two outputs: the React SPA (dist/client) and, in
// development only, the Hono routes served in the same process through
// @hono/vite-dev-server. Production hosts import src/server/app.ts through
// their own entries (src/hosts/workers.ts, api/index.ts) and serve dist/client
// as static assets; nothing here runs on a host.
import devServer from "@hono/vite-dev-server";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: { outDir: "dist/client" },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/app/routes",
      generatedRouteTree: "./src/app/routeTree.gen.ts",
    }),
    react(),
    devServer({
      entry: "src/hosts/dev.ts",
      // Only the routes the app owns go to Hono; everything else is Vite's.
      exclude: [/^(?!\/(api|auth)(\/|$)).*/],
    }),
  ],
});
