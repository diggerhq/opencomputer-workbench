// A signed-in member for route tests: the cookie is minted with the app's
// own sealing code, as the callback would mint it.
import { SESSION_COOKIE, type SessionClaims, seal } from "../../src/server/auth";
import type { Config } from "../../src/server/env";

export const T0 = Date.UTC(2026, 8, 15, 20, 46, 0);
const HOUR = 60 * 60 * 1000;

export const MEMBER: SessionClaims = {
  uid: 1,
  login: "octocat",
  avatar: "",
  ws: { policy: "team:100/200", display: "acme/platform", project: "proj_1", environment: "development" },
  checkedAt: T0,
  token: "gho_token",
  exp: T0 + 24 * HOUR,
};

export async function memberHeaders(cfg: Config, extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return { cookie: `${SESSION_COOKIE}=${await seal(MEMBER, cfg)}`, ...extra };
}

/** Headers for a state-changing request from the app's own origin. */
export async function memberPost(cfg: Config): Promise<Record<string, string>> {
  return memberHeaders(cfg, { origin: cfg.origin, "content-type": "application/json" });
}

export const OC = "https://app.opencomputer.dev/api/managed-agents";
