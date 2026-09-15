import { type Config, readConfig } from "../src/server/env";

export const COOKIE_KEY = Buffer.alloc(32, 7).toString("base64");

export const SOURCE: Record<string, string> = {
  OPENCOMPUTER_API_KEY: "test-key",
  OPENCOMPUTER_PROJECT_ID: "proj_1",
  OPENCOMPUTER_ENVIRONMENT: "development",
  OPENCOMPUTER_AGENT_ID: "worker",
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  WORKBENCH_COOKIE_KEY: COOKIE_KEY,
  WORKBENCH_MEMBERSHIP: "team:100/200",
  WORKBENCH_ORIGIN: "https://workbench.example",
};

export function config(overrides: Record<string, string | undefined> = {}): Config {
  return readConfig({ ...SOURCE, ...overrides });
}

export type Fake = typeof globalThis.fetch & { calls: { url: string; init?: RequestInit }[] };

/** A fetch whose answers are chosen by URL prefix; unmatched requests fail loudly. */
export function fakeFetch(
  routes: Record<string, (url: URL, init?: RequestInit) => Response | Promise<Response>>,
): Fake {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url: url.toString(), init });
    for (const [prefix, handler] of Object.entries(routes)) {
      if (url.toString().startsWith(prefix)) return handler(url, init);
    }
    throw new Error(`Unexpected request: ${url.toString()}`);
  }) as Fake;
  fake.calls = calls;
  return fake;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A team membership answer that admits user 1 into team 200 of org 100. */
export const GITHUB_MEMBER = {
  "https://api.github.com/user/teams": () =>
    json([{ id: 200, slug: "platform", name: "Platform", organization: { id: 100, login: "acme" } }]),
  "https://api.github.com/user": () =>
    json({ id: 1, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" }),
};

export const PROJECT = {
  "https://app.opencomputer.dev/api/managed-agents/projects/proj_1": () =>
    json({
      project: {
        id: "proj_1",
        slug: "workbench",
        name: "Workbench",
        environments: [
          { name: "development", agentId: "worker", activeDeploymentId: "dep_dev" },
          { name: "production", agentId: "worker" },
        ],
        agents: [{ id: "worker", name: "worker" }],
      },
      deployments: [],
    }),
};
