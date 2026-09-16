// POST /auth/logout: clear the cookie. Same-origin only, like every write.
import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie } from "@/server/auth";
import { config } from "@/server/env";
import { sameOrigin } from "../-middleware";

export const Route = createFileRoute("/auth/logout")({
  server: {
    middleware: [sameOrigin],
    handlers: {
      POST: () => new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(config()) } }),
    },
  },
});
