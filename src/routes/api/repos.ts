// GET /api/repos: the repositories the GitHub installation selects for the
// configured environment, with their default branches. The selection in
// GitHub is the whole boundary; the workbench keeps no list of its own.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@/server/client";
import { config, deps } from "@/server/env";
import { handle } from "@/server/problem";
import { type Handled, member } from "../-middleware";

export const Route = createFileRoute("/api/repos")({
  server: {
    middleware: [member],
    handlers: {
      GET: handle(async ({ request }: Handled) => {
        const settings = config();
        const oc = createClient(settings, deps().fetch);
        const cursor = new URL(request.url).searchParams.get("cursor");
        const page = await oc.projects.github.repositories(settings.oc.projectId, {
          environment: settings.oc.environment,
          ...(cursor ? { cursor } : {}),
        });
        return Response.json({
          repositories: page.repositories
            .filter((repo) => !repo.archived)
            .map(({ fullName, defaultBranch, private: isPrivate }) => ({
              fullName,
              defaultBranch,
              private: isPrivate,
            })),
          nextCursor: page.nextCursor,
        });
      }),
    },
  },
});
