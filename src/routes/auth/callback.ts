// GET /auth/callback: exchange the code, check membership, issue the cookie.
import { createFileRoute } from "@tanstack/react-router";
import { callback } from "@/server/auth";
import { config, deps } from "@/server/env";

export const Route = createFileRoute("/auth/callback")({
  server: { handlers: { GET: ({ request }) => callback(request, config(), deps()) } },
});
