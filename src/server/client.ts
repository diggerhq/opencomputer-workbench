// The management client: `@opencomputer/sdk/agents`, the portable subpath of
// the SDK, pointed at the configured origin with the host's fetch. It mirrors
// the management API one to one and checks every answer against the
// documented shape, so this module adds only what the API's contract asks
// of a caller: a bounded repeat of a write whose row was not yet confirmed in
// the list.
import { OpenComputer, OpenComputerError } from "@opencomputer/sdk/agents";
import type { Config } from "./env";

export type {
  Repository,
  Session,
  SessionResult,
  SessionSummary,
  Turn,
  TurnReceipt,
} from "@opencomputer/sdk/agents";
export { OpenComputerError };

export type Client = OpenComputer;

export function createClient(config: Config, fetchImpl: typeof globalThis.fetch): Client {
  return new OpenComputer({
    apiKey: config.oc.apiKey,
    baseUrl: `${config.oc.origin}/api/managed-agents`,
    fetch: fetchImpl,
  });
}

const PUBLICATION_ATTEMPTS = 3;

/**
 * A `503 session_publication_unconfirmed` means the session or its labels
 * are recorded but the row was not confirmed in the list in time; the same
 * call is safe to repeat (the key and last-write-wins labels see to that),
 * so it is repeated a bounded number of times within this request before
 * the problem is forwarded.
 */
export async function untilPublished<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (cause) {
      const unconfirmed = cause instanceof OpenComputerError && cause.code === "session_publication_unconfirmed";
      if (!unconfirmed || attempt >= PUBLICATION_ATTEMPTS) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}
