// GET /api/workspace: who is signed in, the environment the workbench uses,
// the membership rule's name. Nothing about deployments: addressing the
// agent is the server's job when a task starts, and choosing the deployment
// is the platform's.
import { createFileRoute } from "@tanstack/react-router";
import { config } from "@/server/env";
import { handle } from "@/server/problem";
import { type Handled, member } from "../-middleware";

export const Route = createFileRoute("/api/workspace")({
  server: {
    middleware: [member],
    handlers: {
      GET: handle(async ({ context }: Handled) => {
        const settings = config();
        return Response.json({
          identity: context.member.identity,
          environment: settings.oc.environment,
          membership: context.member.membership,
        });
      }),
    },
  },
});
