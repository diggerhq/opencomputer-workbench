// A replay of the recordings under fixtures/ as the subset of the management
// API the workbench calls. The application is unchanged: it is pointed here
// through OPENCOMPUTER_API_URL and sees rows, sessions and event logs exactly
// as OpenComputer would serve them. This exists so every visual state renders
// without a live run; the acceptance run is live (e2e/live.spec.ts).
//
// List rows are the authored row fixtures as they are. Each log fixture is a
// session of its own whose status, activity and result are derived from the
// log through the app's reducer, so the badge and the timeline agree. Every
// timestamp is shifted by one fixed offset from the fixtures' reference time
// to the present, so relative ages and the starting/not-started boundary
// hold whenever the suite runs. Writes (create, turns, labels, end,
// interrupt) change in-memory state for the run only.
import { readdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AgentEvent, applyEvents, emptyTimeline, turnsOf } from "@opencomputer/react";
import { Hono } from "hono";
import { activityOf, emptyNotes, isSettled, latestResult, noteEvents } from "../src/app/activity";

/** One log entry as the fixtures record it: the hook's event plus the session it belongs to. */
type ActivityEvent = AgentEvent & { sessionId?: string };

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
/** The fixtures' "now": one minute after the row timestamps' reference, as the unit tests read them. */
const REFERENCE = Date.parse("2026-09-15T20:46:00.000Z");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

type Json = Record<string, unknown>;

interface Row extends Json {
  id: string;
  projectId: string;
  agentId: string;
  deploymentId: string;
  environment: string;
  source?: string;
  status: string;
  labels: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  revision: number;
  activity: {
    activeTurnId: string | null;
    queued: number;
    lastSettledTurn: { id: string; status: string; at: string; code?: string } | null;
  };
  result: { turnId: string; callId: string; reportedAt: string; data: unknown } | null;
}

interface Stored {
  row: Row;
  events: ActivityEvent[];
  /** Idempotency keys of admitted turns, for the duplicate answer. */
  keys: Map<string, { turnId: string; status: "queued" | "running" }>;
}

export type ListScenario = "all" | "empty" | "error";

/** The log fixtures as sessions of their own; ids are fixed so specs can open them. */
export const LOG_SESSIONS: Record<string, string> = {
  "created-only": "20000000-0000-4000-8000-000000000001",
  working: "20000000-0000-4000-8000-000000000002",
  completed: "20000000-0000-4000-8000-000000000003",
  "turn-failed-runtime-lost": "20000000-0000-4000-8000-000000000004",
  cancelled: "20000000-0000-4000-8000-000000000005",
  "tool-timed-out": "20000000-0000-4000-8000-000000000006",
  "tool-failed": "20000000-0000-4000-8000-000000000007",
  ended: "20000000-0000-4000-8000-000000000008",
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Shifts every ISO timestamp in a value by `offset` milliseconds. */
function shift(value: unknown, offset: number): unknown {
  if (typeof value === "string") {
    return ISO.test(value) ? new Date(Date.parse(value) + offset).toISOString() : value;
  }
  if (Array.isArray(value)) return value.map((entry) => shift(entry, offset));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shift(entry, offset)]));
  }
  return value;
}

function rowFixtures(): Row[] {
  return readdirSync(join(FIXTURES, "rows"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson<Json>(join(FIXTURES, "rows", name)))
    .filter((entry): entry is Row => typeof entry.id === "string" && typeof entry.status === "string");
}

/** A session built from a log: the working row's labels and title, everything else from the events. */
function sessionFromLog(name: string, id: string, base: Row): Stored {
  const events = readJson<ActivityEvent[]>(join(FIXTURES, "logs", `${name}.json`)).map((event) => ({
    ...event,
    sessionId: id,
  }));
  const activity = activityOf(turnsOf(applyEvents(emptyTimeline(), events)), noteEvents(emptyNotes(), events));
  const running = activity.turns.find((turn) => turn.status === "running");
  const settled = activity.turns.filter(isSettled).at(-1);
  const result = latestResult(activity);
  const last = events.at(-1);
  const created = events[0]?.timestamp ?? base.createdAt;
  const row: Row = {
    ...base,
    id,
    status: activity.ended ? "ended" : (activity.status ?? "idle"),
    labels: {
      ...base.labels,
      request: id,
      archived: "false",
    },
    createdAt: created,
    updatedAt: last?.timestamp ?? created,
    revision: events.length,
    activity: {
      activeTurnId: running?.id ?? null,
      queued: activity.turns.filter((turn) => turn.status === "queued").length,
      lastSettledTurn: settled ? { id: settled.id, status: settled.status, at: settled.settledAt ?? created } : null,
    },
    result: result
      ? {
          turnId: result.turn.id,
          callId: result.turn.toolCalls.find((call) => call.result)?.callId ?? `call_${result.turn.id}`,
          reportedAt: result.turn.settledAt ?? created,
          data: result.report,
        }
      : null,
  };
  return { row, events, keys: new Map() };
}

/** The minimal log of a session that exists and has no turn, for row fixtures without a recording. */
function createdOnly(row: Row): ActivityEvent[] {
  return [
    {
      id: `${row.id}:1`,
      seq: 1,
      timestamp: row.createdAt,
      sessionId: row.id,
      type: "session.created",
      data: { agentId: row.agentId, deploymentId: row.deploymentId },
    },
    {
      id: `${row.id}:2`,
      seq: 2,
      timestamp: row.createdAt,
      sessionId: row.id,
      type: "session.status_changed",
      data: { from: "new", to: row.status === "new" ? "new" : "idle" },
    },
  ];
}

/** `GET /sessions/<id>`: the row plus `turns`, derived from its activity, so `summarize` works on it. */
function sessionOf(stored: Stored): Json {
  const { row } = stored;
  const turns: Json[] = [];
  const { activity } = row;
  if (activity.lastSettledTurn) {
    turns.push({
      id: activity.lastSettledTurn.id,
      input: "",
      mode: "queue",
      status: activity.lastSettledTurn.status,
      createdAt: row.createdAt,
      updatedAt: activity.lastSettledTurn.at,
    });
  }
  if (activity.activeTurnId) {
    turns.push({
      id: activity.activeTurnId,
      input: "",
      mode: "queue",
      status: "running",
      createdAt: row.updatedAt,
      updatedAt: row.updatedAt,
    });
  }
  for (let index = 0; index < activity.queued; index += 1) {
    turns.push({
      id: `${row.id}:queued:${String(index + 1)}`,
      input: "",
      mode: "queue",
      status: "queued",
      createdAt: row.updatedAt,
      updatedAt: row.updatedAt,
    });
  }
  return { ...row, turns };
}

export interface FixtureState {
  scenario: ListScenario;
  sessions: Map<string, Stored>;
}

export function initialState(): FixtureState {
  const sessions = new Map<string, Stored>();
  const rows = rowFixtures();
  for (const row of rows) sessions.set(row.id, { row, events: createdOnly(row), keys: new Map() });
  const base = rows.find(
    (row) => row.labels.title === "Rename the billing module to invoicing" && row.status === "running",
  );
  if (!base) throw new Error("fixtures/rows/working.json is the base row for the log sessions");
  for (const [name, id] of Object.entries(LOG_SESSIONS)) sessions.set(id, sessionFromLog(name, id, base));
  return { scenario: "all", sessions };
}

const project = {
  id: "proj_1",
  slug: "workbench",
  name: "Workbench",
  environments: [
    { name: "development", agentId: "worker", activeDeploymentId: "dep_dev" },
    { name: "production", agentId: "worker" },
  ],
  agents: [{ id: "worker", name: "worker" }],
  createdAt: "2026-09-15T18:00:00.000Z",
  updatedAt: "2026-09-15T18:00:00.000Z",
};

const repositories = [
  { id: 1, fullName: "acme/service", private: true, defaultBranch: "main", archived: false },
  { id: 2, fullName: "acme/web", private: false, defaultBranch: "main", archived: false },
  { id: 3, fullName: "acme/legacy", private: true, defaultBranch: "master", archived: true },
];

function problem(code: string, message: string) {
  return { error: { code, message } };
}

export function fixtureApp(state: FixtureState): Hono {
  const app = new Hono();
  const api = new Hono();
  const now = () => new Date().toISOString();
  const offset = () => Date.now() - REFERENCE;
  const serve = (value: unknown) => shift(value, offset()) as Json;

  // Control routes for the suite: never part of the API the app calls.
  app.get("/__health", (c) => c.json({ ok: true }));
  app.post("/__scenario", async (c) => {
    const body = (await c.req.json()) as { list?: ListScenario };
    if (body.list) state.scenario = body.list;
    return c.json({ list: state.scenario });
  });
  app.post("/__reset", (c) => {
    const fresh = initialState();
    state.scenario = fresh.scenario;
    state.sessions = fresh.sessions;
    return c.json({ ok: true });
  });

  api.get("/projects/:project", (c) =>
    c.req.param("project") === project.id
      ? c.json({ project, deployments: [], sessions: [], connections: [], channels: [], schedules: [] })
      : c.json(problem("project_not_found", "No such project."), 404),
  );

  api.get("/projects/:project/github/repositories", (c) => c.json({ repositories, nextCursor: null }));

  api.get("/deployments/:id", (c) =>
    c.req.param("id") === "dep_dev"
      ? c.json({ id: "dep_dev", agentId: "worker", alias: "development", createdAt: "2026-09-15T18:00:00.000Z" })
      : c.json(problem("deployment_not_found", "No such deployment."), 404),
  );

  api.get("/sessions", (c) => {
    if (state.scenario === "error") return c.json(problem("upstream_error", "OpenComputer answered 503"), 503);
    if (state.scenario === "empty") return c.json({ sessions: [], nextCursor: null });
    const query = c.req.query();
    const labels = Object.entries(query)
      .filter(([key]) => key.startsWith("label."))
      .map(([key, value]) => [key.slice("label.".length), value] as const);
    const rows = [...state.sessions.values()]
      .map((stored) => stored.row)
      .filter((row) => !Object.values(LOG_SESSIONS).includes(row.id))
      .filter((row) => !query.project || row.projectId === query.project)
      .filter((row) => !query.environment || row.environment === query.environment)
      .filter((row) => !query.agent || row.agentId === query.agent)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => labels.every(([key, value]) => row.labels[key] === value))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
    const limit = Math.min(100, Number(query.limit) || 50);
    const start = query.cursor ? Number(query.cursor.replace(/^c_/, "")) || 0 : 0;
    const page = rows.slice(start, start + limit);
    const nextCursor = start + limit < rows.length ? `c_${String(start + limit)}` : null;
    return c.json({ sessions: page.map(serve), nextCursor });
  });

  api.post("/sessions", async (c) => {
    const body = (await c.req.json()) as {
      deploymentId?: string;
      environment?: string;
      labels?: Record<string, string>;
    };
    const key = c.req.header("idempotency-key") ?? crypto.randomUUID();
    const existing = [...state.sessions.values()].find((stored) => stored.row.labels.request === key);
    if (existing) {
      const { id, status, createdAt } = existing.row;
      return c.json({ session: { id, status, createdAt } }, 200);
    }
    const id = crypto.randomUUID();
    const createdAt = now();
    const row: Row = {
      id,
      projectId: project.id,
      agentId: "worker",
      deploymentId: body.deploymentId ?? "dep_dev",
      environment: body.environment ?? "development",
      source: "api",
      status: "new",
      labels: { ...(body.labels ?? {}) },
      createdAt,
      updatedAt: createdAt,
      revision: 1,
      activity: { activeTurnId: null, queued: 0, lastSettledTurn: null },
      result: null,
    };
    const stored: Stored = { row, events: [], keys: new Map() };
    stored.events = createdOnly(row).map((event) => ({ ...event, timestamp: createdAt }));
    state.sessions.set(id, stored);
    return c.json({ session: { id, status: row.status, createdAt } }, 201);
  });

  api.get("/sessions/:id", (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    return stored ? c.json(serve(sessionOf(stored))) : c.json(problem("session_not_found", "No such session."), 404);
  });

  api.get("/sessions/:id/events", (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    if (!stored) return c.json(problem("session_not_found", "No such session."), 404);
    const after = Number(c.req.query("after") ?? "0");
    return c.json({
      events: stored.events
        .filter((event) => event.seq > after)
        .slice(0, 500)
        .map(serve),
    });
  });

  api.post("/sessions/:id/turns", async (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    if (!stored) return c.json(problem("session_not_found", "No such session."), 404);
    if (stored.row.status === "ended") {
      return c.json(problem("memory_admission_rejected", "The session has ended."), 409);
    }
    const body = (await c.req.json()) as { input?: string; idempotencyKey?: string; mode?: string };
    if (!body.input?.trim()) return c.json(problem("invalid_turn", "input is required."), 400);
    if (body.idempotencyKey) {
      const seen = stored.keys.get(body.idempotencyKey);
      if (seen) return c.json({ ...seen, duplicate: true }, 200);
    }
    const turnId = crypto.randomUUID();
    const at = now();
    const seq = (stored.events.at(-1)?.seq ?? 0) + 1;
    const mode = body.mode ?? "queue";
    stored.events.push(
      {
        id: crypto.randomUUID(),
        seq,
        timestamp: at,
        sessionId: stored.row.id,
        turnId,
        type: "message.received",
        data: { input: body.input, mode },
      },
      {
        id: crypto.randomUUID(),
        seq: seq + 1,
        timestamp: at,
        sessionId: stored.row.id,
        turnId,
        type: "turn.queued",
        data: { mode },
      },
    );
    const busy = stored.row.activity.activeTurnId !== null;
    const receipt = { turnId, status: busy ? ("queued" as const) : ("queued" as const) };
    stored.row = {
      ...stored.row,
      updatedAt: at,
      revision: stored.row.revision + 1,
      activity: { ...stored.row.activity, queued: stored.row.activity.queued + 1 },
    };
    if (body.idempotencyKey) stored.keys.set(body.idempotencyKey, receipt);
    return c.json({ ...receipt, duplicate: false }, 202);
  });

  api.patch("/sessions/:id/labels", async (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    if (!stored) return c.json(problem("session_not_found", "No such session."), 404);
    const body = (await c.req.json()) as { set?: Record<string, string>; unset?: string[] };
    const labels = { ...stored.row.labels, ...(body.set ?? {}) };
    for (const key of body.unset ?? []) delete labels[key];
    stored.row = { ...stored.row, labels, updatedAt: now(), revision: stored.row.revision + 1 };
    return c.json(serve(sessionOf(stored)));
  });

  api.post("/sessions/:id/end", (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    if (!stored) return c.json(problem("session_not_found", "No such session."), 404);
    if (stored.row.status !== "ended") {
      const at = now();
      const seq = (stored.events.at(-1)?.seq ?? 0) + 1;
      stored.events.push({
        id: crypto.randomUUID(),
        seq,
        timestamp: at,
        sessionId: stored.row.id,
        type: "session.ended",
        data: {},
      });
      stored.row = {
        ...stored.row,
        status: "ended",
        updatedAt: at,
        revision: stored.row.revision + 1,
        activity: { activeTurnId: null, queued: 0, lastSettledTurn: stored.row.activity.lastSettledTurn },
      };
    }
    return c.json(serve(sessionOf(stored)));
  });

  api.post("/sessions/:id/interrupt", (c) => {
    const stored = state.sessions.get(c.req.param("id"));
    if (!stored) return c.json(problem("session_not_found", "No such session."), 404);
    const running = stored.row.activity.activeTurnId;
    if (running) {
      const at = now();
      const seq = (stored.events.at(-1)?.seq ?? 0) + 1;
      stored.events.push(
        {
          id: crypto.randomUUID(),
          seq,
          timestamp: at,
          sessionId: stored.row.id,
          turnId: running,
          type: "turn.cancelled",
          data: { reason: "interrupted" },
        },
        {
          id: crypto.randomUUID(),
          seq: seq + 1,
          timestamp: at,
          sessionId: stored.row.id,
          type: "session.status_changed",
          data: { from: "running", to: "idle" },
        },
      );
      stored.row = {
        ...stored.row,
        status: "idle",
        updatedAt: at,
        revision: stored.row.revision + 1,
        activity: {
          ...stored.row.activity,
          activeTurnId: null,
          lastSettledTurn: { id: running, status: "cancelled", at },
        },
      };
    }
    return c.json(serve(sessionOf(stored)));
  });

  app.route("/api/managed-agents", api);
  app.notFound((c) => c.json(problem("not_found", `No such route: ${c.req.method} ${c.req.path}`), 404));
  return app;
}

/** Serves a Hono app on Node's http module; the adapter package is not a dependency of the workbench. */
export function listen(app: Hono, port: number): Promise<Server> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const method = req.method ?? "GET";
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const request = new Request(`http://localhost:${String(port)}${req.url ?? "/"}`, {
      method,
      headers,
      body: chunks.length && method !== "GET" && method !== "HEAD" ? Buffer.concat(chunks) : undefined,
    });
    const response = await app.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
