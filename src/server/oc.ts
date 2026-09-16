// STOPGAP(C5): a thin typed fetch wrapper over the documented management API
// (docs/agents/api.mdx) and the C1, C2 and C3 seams of the workbench design.
// Deleted, with no behavior change, when `@opencomputer/sdk/agents`, the
// portable client, is published; until then this is the only module that knows the
// API's paths and shapes. Every response is parsed at this boundary and the
// types are inferred from the schemas; unknown extra fields pass through.
import { z } from "zod";
import { type Report, reportSchema } from "../lib/report";
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

const environmentSchema = z.enum(["development", "production"]);

const projectSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string(),
  environments: z.array(
    z.object({
      name: environmentSchema,
      agentId: z.string(),
      activeDeploymentId: z.string().optional(),
    }),
  ),
  agents: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type Project = z.infer<typeof projectSchema>;

const deploymentSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  alias: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export type Deployment = z.infer<typeof deploymentSchema>;

/** Session status as documented, plus `stopping` from C4. */
const sessionStatus = z.string();

const turnStatus = z.string();

const settledTurnSchema = z.object({
  id: z.string(),
  status: z.enum(["completed", "failed", "cancelled"]),
  at: z.string(),
  /** The public failure code when the turn failed, if the row carries it. */
  code: z.string().optional(),
});

const activitySchema = z.object({
  activeTurnId: z.string().nullable(),
  queued: z.number().int().nonnegative(),
  lastSettledTurn: settledTurnSchema.nullable(),
});

export type Activity = z.infer<typeof activitySchema>;

/**
 * A committed result (C1): the latest output of the agent's result tool.
 * `data` is validated against the report schema here; invalid data is
 * treated as no result and logged, because a row must never fail to render
 * over a field the app does not own.
 */
const resultSchema = z
  .object({
    turnId: z.string(),
    callId: z.string(),
    reportedAt: z.string(),
    data: z.unknown(),
  })
  .transform((value): SessionResult | null => {
    const parsed = reportSchema.safeParse(value.data);
    if (!parsed.success) {
      console.warn(`Session result from turn ${value.turnId} does not match the report schema; ignored.`);
      return null;
    }
    return { turnId: value.turnId, callId: value.callId, reportedAt: value.reportedAt, data: parsed.data };
  });

export interface SessionResult {
  readonly turnId: string;
  readonly callId: string;
  readonly reportedAt: string;
  readonly data: Report;
}

const labelsSchema = z.record(z.string(), z.string());

/** One row of `GET /sessions` (C1). */
const sessionSummarySchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  agentId: z.string(),
  deploymentId: z.string(),
  /** `null` when the session has no environment (api.mdx, the row). */
  environment: environmentSchema.nullable().default(null),
  source: z.string().optional(),
  status: sessionStatus,
  labels: labelsSchema.default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative().default(0),
  activity: activitySchema,
  result: resultSchema.nullable().default(null),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

const turnSchema = z.object({
  id: z.string(),
  input: z.string().optional(),
  mode: z.string().optional(),
  status: turnStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Turn = z.infer<typeof turnSchema>;

/** `GET /sessions/<id>`: the documented shape plus the C1 fields when present. */
const sessionSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  agentId: z.string(),
  deploymentId: z.string(),
  environment: environmentSchema.optional(),
  source: z.string().optional(),
  status: sessionStatus,
  turns: z.array(turnSchema).default([]),
  labels: labelsSchema.default({}),
  labelsUpdatedAt: z.string().optional(),
  executionMode: z.string().optional(),
  revision: z.number().int().nonnegative().optional(),
  activity: activitySchema.optional(),
  result: resultSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

const createdSessionSchema = z.object({
  session: z.object({
    id: z.string(),
    status: sessionStatus,
    createdAt: z.string(),
  }),
});

/**
 * The turn's persisted status: `queued` or `running` for a new turn, and for
 * a repeated key whatever the existing turn has reached.
 */
const turnReceiptSchema = z.object({
  turnId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  duplicate: z.boolean().default(false),
});

export type TurnReceipt = z.infer<typeof turnReceiptSchema>;

const eventSchema = z.object({
  id: z.string().optional(),
  seq: z.number(),
  timestamp: z.string().optional(),
  sessionId: z.string().optional(),
  turnId: z.string().optional(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type SessionEvent = z.infer<typeof eventSchema>;

/** One repository of `GET /projects/<p>/github/repositories` (C3). */
const repositorySchema = z.object({
  id: z.number().optional(),
  fullName: z.string(),
  private: z.boolean().default(false),
  defaultBranch: z.string(),
  archived: z.boolean().default(false),
});

export type Repository = z.infer<typeof repositorySchema>;

export interface ListSessionsQuery {
  readonly project: string;
  readonly environment: Environment;
  readonly agent: string;
  readonly status?: string;
  /** Up to three equality filters on labels. */
  readonly labels?: Readonly<Record<string, string>>;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface CreateSessionBody {
  readonly deploymentId: string;
  readonly environment: Environment;
  readonly labels: Readonly<Record<string, string>>;
  readonly source: "api";
}

export interface SendTurnBody {
  readonly input: string;
  readonly payload?: unknown;
  readonly idempotencyKey: string;
  readonly mode?: "queue" | "steer" | "interrupt";
}

export interface OC {
  readonly projects: {
    get(id: string): Promise<Project>;
  };
  readonly agents: {
    /** The agent's active deployment in the environment, or null when it is not deployed there. */
    activeDeployment(agentId: string, environment: Environment): Promise<string | null>;
  };
  readonly deployments: {
    get(id: string): Promise<Deployment>;
  };
  readonly sessions: {
    list(query: ListSessionsQuery): Promise<{ sessions: SessionSummary[]; nextCursor: string | null }>;
    /** `201` and `200` (the key had already created it) both resolve with the session. */
    create(body: CreateSessionBody, idempotencyKey: string): Promise<{ id: string; status: string; createdAt: string }>;
    get(id: string): Promise<Session>;
    setLabels(id: string, change: { set?: Record<string, string>; unset?: string[] }): Promise<Session>;
    end(id: string): Promise<Session>;
    interrupt(id: string): Promise<Session>;
  };
  readonly turns: {
    send(sessionId: string, body: SendTurnBody): Promise<TurnReceipt>;
  };
  readonly events: {
    list(sessionId: string, after: number): Promise<SessionEvent[]>;
  };
  readonly github: {
    repositories(
      environment: Environment,
      cursor?: string | null,
    ): Promise<{ repositories: Repository[]; nextCursor: string | null }>;
  };
  /**
   * Forwards one session request unchanged, for the three routes the React
   * hook needs: the caller has already checked the session's scope.
   */
  forward(path: string, init: RequestInit): Promise<Response>;
}

const PUBLICATION_ATTEMPTS = 3;

/**
 * A `503 session_publication_unconfirmed` means the session or its labels are
 * recorded but the row was not confirmed in the list in time; the same call
 * is safe to repeat (the key and last-write-wins labels see to that), so it
 * is repeated a bounded number of times within this request before the
 * problem is forwarded.
 */
async function untilPublished<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (cause) {
      const unconfirmed = cause instanceof OCError && cause.code === "session_publication_unconfirmed";
      if (!unconfirmed || attempt >= PUBLICATION_ATTEMPTS) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

export function createOC(config: Config, fetchImpl: typeof globalThis.fetch): OC {
  const base = `${config.oc.origin}/api/managed-agents`;

  function headers(init: RequestInit, idempotencyKey?: string): Record<string, string> {
    return {
      "x-api-key": config.oc.apiKey,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
  }

  async function send(path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<Response> {
    return fetchImpl(`${base}${path}`, {
      ...init,
      headers: headers(init, idempotencyKey),
      // Never follow a redirect with the key attached.
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
  }

  async function failure(response: Response): Promise<never> {
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

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    idempotencyKey?: string,
  ): Promise<T> {
    const response = await send(path, init, idempotencyKey);
    if (!response.ok) return failure(response);
    return schema.parse(await response.json());
  }

  const projects: OC["projects"] = {
    get: (id) =>
      request(`/projects/${encodeURIComponent(id)}`, z.object({ project: projectSchema })).then((body) => body.project),
  };

  const session = (id: string) => `/sessions/${encodeURIComponent(id)}`;

  const oc: OC = {
    projects,
    agents: {
      async activeDeployment(agentId: string, environment: Environment) {
        const project = await projects.get(config.oc.projectId);
        const match = project.environments.find((entry) => entry.agentId === agentId && entry.name === environment);
        return match?.activeDeploymentId || null;
      },
    },
    deployments: {
      get: (id) => request(`/deployments/${encodeURIComponent(id)}`, deploymentSchema),
    },
    sessions: {
      list(query) {
        const params = new URLSearchParams({
          project: query.project,
          environment: query.environment,
          agent: query.agent,
        });
        if (query.status) params.set("status", query.status);
        for (const [key, value] of Object.entries(query.labels ?? {}).slice(0, 3)) {
          params.set(`label.${key}`, value);
        }
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit) params.set("limit", String(query.limit));
        return request(
          `/sessions?${params.toString()}`,
          z.object({ sessions: z.array(sessionSummarySchema), nextCursor: z.string().nullable().default(null) }),
        );
      },
      create: (body, idempotencyKey) =>
        untilPublished(() =>
          request("/sessions", createdSessionSchema, { method: "POST", body: JSON.stringify(body) }, idempotencyKey),
        ).then((created) => created.session),
      get: (id) => request(session(id), sessionSchema),
      setLabels: (id, change) =>
        untilPublished(() =>
          request(`${session(id)}/labels`, sessionSchema, { method: "PATCH", body: JSON.stringify(change) }),
        ),
      end: (id) => request(`${session(id)}/end`, sessionSchema, { method: "POST" }),
      interrupt: (id) => request(`${session(id)}/interrupt`, sessionSchema, { method: "POST" }),
    },
    turns: {
      send: (sessionId, body) =>
        request(`${session(sessionId)}/turns`, turnReceiptSchema, { method: "POST", body: JSON.stringify(body) }),
    },
    events: {
      list: (sessionId, after) =>
        request(`${session(sessionId)}/events?after=${String(after)}`, z.object({ events: z.array(eventSchema) })).then(
          (body) => body.events,
        ),
    },
    github: {
      repositories(environment, cursor) {
        const params = new URLSearchParams({ environment });
        if (cursor) params.set("cursor", cursor);
        return request(
          `/projects/${encodeURIComponent(config.oc.projectId)}/github/repositories?${params.toString()}`,
          z.object({ repositories: z.array(repositorySchema), nextCursor: z.string().nullable().default(null) }),
        );
      },
    },
    forward: (path, init) => send(path, init),
  };
  return Object.freeze(oc);
}
