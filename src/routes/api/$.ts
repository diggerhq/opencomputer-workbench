// Anything else under /api is a problem, not a page: a member gets a 404 in
// the one error shape, a non-member the same 401 as every other route.
import { createFileRoute } from "@tanstack/react-router";
import { problem } from "@/server/problem";
import { member } from "../-middleware";

const notFound = () => problem(404, "not_found", "No such route.");

export const Route = createFileRoute("/api/$")({
  server: {
    middleware: [member],
    handlers: { GET: notFound, POST: notFound, PATCH: notFound, PUT: notFound, DELETE: notFound },
  },
});
