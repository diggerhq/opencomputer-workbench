// GET /auth/login: send the browser to GitHub with a state kept in a cookie.
import { createFileRoute } from "@tanstack/react-router";
import { login } from "@/server/auth";
import { config } from "@/server/env";

export const Route = createFileRoute("/auth/login")({
  server: { handlers: { GET: () => login(config()) } },
});
