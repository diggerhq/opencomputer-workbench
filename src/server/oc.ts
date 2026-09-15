// STOPGAP(C5): a thin typed fetch wrapper over the documented management API
// (docs/agents/api.mdx). Deleted, with no behavior change, when
// `@opencomputer/sdk/managed-agents` ships a portable client; until then this
// is the only module that knows the API's paths and shapes. Every response is
// parsed at this boundary and the types are inferred from the schemas.
import { z } from "zod";
import type { Config, Environment } from "./env";

export class OCError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OCError";
  }
}

const errorEnvelope = z.object({
  error: z.union([z.object({ code: z.string(), message: z.string() }), z.string()]),
});

const projectSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string(),
  environments: z.array(
    z.object({
      name: z.enum(["development", "production"]),
      agentId: z.string(),
      activeDeploymentId: z.string().optional(),
    }),
  ),
  agents: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type Project = z.infer<typeof projectSchema>;

export interface OC {
  readonly projects: {
    get(id: string): Promise<Project>;
  };
  readonly agents: {
    /** The agent's active deployment in the environment, or null when it is not deployed there. */
    activeDeployment(agentId: string, environment: Environment): Promise<string | null>;
  };
}

export function createOC(config: Config, fetchImpl: typeof globalThis.fetch): OC {
  const base = `${config.oc.origin}/api/managed-agents`;

  async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        "x-api-key": config.oc.apiKey,
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      // Never follow a redirect with the key attached.
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      const parsed = errorEnvelope.safeParse(body);
      if (parsed.success) {
        const { error } = parsed.data;
        throw typeof error === "string"
          ? new OCError(response.status, "upstream_error", error)
          : new OCError(response.status, error.code, error.message);
      }
      throw new OCError(response.status, "upstream_error", `OpenComputer answered ${String(response.status)}`);
    }
    return schema.parse(await response.json());
  }

  const projects: OC["projects"] = {
    get: (id) =>
      request(`/projects/${encodeURIComponent(id)}`, z.object({ project: projectSchema })).then((body) => body.project),
  };

  return Object.freeze({
    projects,
    agents: {
      async activeDeployment(agentId: string, environment: Environment) {
        const project = await projects.get(config.oc.projectId);
        const match = project.environments.find((entry) => entry.agentId === agentId && entry.name === environment);
        return match?.activeDeploymentId || null;
      },
    },
  });
}
