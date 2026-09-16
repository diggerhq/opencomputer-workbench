// GET /api/workspace: who is signed in, the agent's active deployment in the
// configured environment (the composer pins it), the membership rule's name.
import { createFileRoute } from "@tanstack/react-router";
import { activeDeployment } from "@/server/client";
import { handle, problem } from "@/server/problem";
import { type Handled, member } from "../-guards";

export const Route = createFileRoute("/api/workspace")({
  server: {
    middleware: [member],
    handlers: {
      GET: handle(async ({ context }: Handled) => {
        const { config: settings, client: oc } = context;
        const deploymentId = await activeDeployment(oc, settings, settings.oc.agentId, settings.oc.environment);
        if (!deploymentId) {
          return problem(
            409,
            "agent_not_deployed",
            `The agent is not deployed to ${settings.oc.environment} in this project.`,
          );
        }
        return Response.json({
          identity: context.member.identity,
          deploymentId,
          environment: settings.oc.environment,
          membership: context.member.membership,
        });
      }),
    },
  },
});
