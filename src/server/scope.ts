// The authorization model, whole: the organization key reaches every project
// the organization has, so every session id from the browser is fetched and
// checked against the configured project, environment and agent before any
// proxied call. A session outside the workbench is indistinguishable from a
// missing one; existence is never revealed.
import { type Client, OpenComputerError, type Session } from "./client";
import type { Config } from "./env";

export class ScopeError extends Error {
  constructor(readonly sessionId: string) {
    super("No such task.");
    this.name = "ScopeError";
  }
}

/** The bare agent id: `worker` from `worker` or `worker@development`. */
function bareAgentId(agentId: string): string {
  const at = agentId.indexOf("@");
  return at < 0 ? agentId : agentId.slice(0, at);
}

export async function workbenchSession(oc: Client, config: Config, id: string): Promise<Session> {
  let session: Session;
  try {
    session = await oc.sessions.get(id);
  } catch (cause) {
    if (cause instanceof OpenComputerError && cause.status === 404) throw new ScopeError(id);
    throw cause;
  }
  if (bareAgentId(session.agentId) !== config.oc.agentId) throw new ScopeError(id);
  if (session.environment !== undefined && session.environment !== config.oc.environment) throw new ScopeError(id);
  if (session.projectId !== undefined && session.projectId !== config.oc.projectId) throw new ScopeError(id);
  return session;
}
