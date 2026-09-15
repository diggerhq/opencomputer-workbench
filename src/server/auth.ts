// GitHub sign-in and the cookie. The one file to replace for another
// identity provider: login redirect, callback to cookie, identity and
// renewal from a request. The cookie is the whole session; the app keeps no
// session table. Its contract is in the design's Access section.
import { GitHub, generateState, OAuth2RequestError } from "arctic";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { Config } from "./env";
import { admit, policyId } from "./membership";

export const SESSION_COOKIE = "wb_session";
const STATE_COOKIE = "wb_oauth_state";
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RECHECK_AFTER_MS = 60 * 60 * 1000;
const STATE_LIFETIME_S = 10 * 60;
const SCOPES = ["read:org"];

export interface Identity {
  readonly id: number;
  readonly login: string;
  readonly avatarUrl: string;
}

export interface AuthDeps {
  readonly fetch: typeof globalThis.fetch;
  /** Milliseconds since the epoch. */
  readonly now: () => number;
}

export const defaultDeps: AuthDeps = Object.freeze({ fetch: globalThis.fetch.bind(globalThis), now: () => Date.now() });

/** What the cookie holds. `ws` binds it to this workspace's configuration. */
export interface SessionClaims {
  readonly uid: number;
  readonly login: string;
  readonly avatar: string;
  readonly ws: {
    readonly policy: string;
    readonly display: string;
    readonly project: string;
    readonly environment: string;
  };
  /** Milliseconds: the last successful membership check. */
  readonly checkedAt: number;
  /** The OAuth token, scope read:org; used only to re-check membership. */
  readonly token: string;
  /** Milliseconds: absolute expiry, fixed at sign-in. */
  readonly exp: number;
}

function binding(config: Config): { policy: string; project: string; environment: string } {
  return { policy: policyId(config.membership), project: config.oc.projectId, environment: config.oc.environment };
}

function secure(config: Config): boolean {
  return !config.origin.startsWith("http://localhost");
}

function cookie(name: string, value: string, config: Config, maxAgeSeconds: number, path = "/"): string {
  const parts = [
    `${name}=${value}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${String(Math.max(0, Math.floor(maxAgeSeconds)))}`,
  ];
  if (secure(config)) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(config: Config): string {
  return cookie(SESSION_COOKIE, "", config, 0);
}

export async function seal(claims: SessionClaims, config: Config): Promise<string> {
  const { exp, ...rest } = claims;
  return new EncryptJWT({ ...rest })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(Math.floor(claims.checkedAt / 1000))
    .setExpirationTime(Math.floor(exp / 1000))
    .encrypt(config.cookieKey);
}

/** Decrypts and validates a cookie value against expiry and the workspace binding; null otherwise. */
export async function open(value: string, config: Config, nowMs: number): Promise<SessionClaims | null> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtDecrypt(value, config.cookieKey, { currentDate: new Date(nowMs) }));
  } catch {
    return null;
  }
  const ws = payload.ws as SessionClaims["ws"] | undefined;
  const expected = binding(config);
  if (
    typeof payload.uid !== "number" ||
    typeof payload.login !== "string" ||
    typeof payload.token !== "string" ||
    typeof payload.checkedAt !== "number" ||
    typeof payload.exp !== "number" ||
    !ws ||
    ws.policy !== expected.policy ||
    ws.project !== expected.project ||
    ws.environment !== expected.environment
  ) {
    return null;
  }
  return {
    uid: payload.uid,
    login: payload.login,
    avatar: typeof payload.avatar === "string" ? payload.avatar : "",
    ws: { ...ws, display: typeof ws.display === "string" ? ws.display : "" },
    checkedAt: payload.checkedAt,
    token: payload.token,
    exp: payload.exp * 1000,
  };
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/**
 * The identity behind a request, or null. Re-checks membership when the last
 * check is older than an hour and hands back the header that rewrites the
 * cookie; a failed or overdue check never extends admission.
 */
export async function identity(
  req: Request,
  config: Config,
  deps: AuthDeps = defaultDeps,
): Promise<{ identity: Identity; membership: { kind: string; display: string }; setCookie?: string } | null> {
  const value = readCookie(req, SESSION_COOKIE);
  if (!value) return null;
  const now = deps.now();
  const claims = await open(value, config, now);
  if (!claims) return null;
  const result = {
    identity: { id: claims.uid, login: claims.login, avatarUrl: claims.avatar },
    membership: { kind: config.membership.kind, display: claims.ws.display },
  };
  if (now - claims.checkedAt < RECHECK_AFTER_MS) return result;
  const admission = await admit(claims.token, config.membership, deps.fetch);
  if (!admission.ok) return null;
  const renewed: SessionClaims = { ...claims, checkedAt: now, ws: { ...claims.ws, display: admission.display } };
  return {
    ...result,
    membership: { kind: config.membership.kind, display: admission.display },
    setCookie: cookie(SESSION_COOKIE, await seal(renewed, config), config, (claims.exp - now) / 1000),
  };
}

function provider(config: Config): GitHub {
  return new GitHub(config.github.clientId, config.github.clientSecret, `${config.origin}/auth/callback`);
}

/** GET /auth/login: redirect to GitHub with a state kept in a short-lived cookie. */
export function login(config: Config): Response {
  // GitHub's OAuth flow does not support PKCE; state is the CSRF protection here.
  const state = generateState();
  const url = provider(config).createAuthorizationURL(state, SCOPES);
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), "set-cookie": cookie(STATE_COOKIE, state, config, STATE_LIFETIME_S, "/auth") },
  });
}

function redirect(location: string, setCookies: string[]): Response {
  const headers = new Headers({ location });
  for (const value of setCookies) headers.append("set-cookie", value);
  return new Response(null, { status: 302, headers });
}

/** GET /auth/callback: exchange the code, check membership, issue the cookie. */
export async function callback(req: Request, config: Config, deps: AuthDeps = defaultDeps): Promise<Response> {
  const url = new URL(req.url);
  const clearState = cookie(STATE_COOKIE, "", config, 0, "/auth");
  const denied = (reason: string) => redirect(`/?error=${reason}`, [clearState]);
  if (url.searchParams.get("error")) return denied("access_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== readCookie(req, STATE_COOKIE)) return denied("invalid_state");
  let token: string;
  try {
    token = (await provider(config).validateAuthorizationCode(code)).accessToken();
  } catch (cause) {
    if (cause instanceof OAuth2RequestError) return denied("exchange_failed");
    throw cause;
  }
  const userResponse = await deps.fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "opencomputer-workbench",
    },
  });
  if (!userResponse.ok) return denied("exchange_failed");
  const user = (await userResponse.json()) as { id?: unknown; login?: unknown; avatar_url?: unknown };
  if (typeof user.id !== "number" || typeof user.login !== "string") return denied("exchange_failed");
  const admission = await admit(token, config.membership, deps.fetch);
  if (!admission.ok) return denied("not_a_member");
  const now = deps.now();
  const claims: SessionClaims = {
    uid: user.id,
    login: user.login,
    avatar: typeof user.avatar_url === "string" ? user.avatar_url : "",
    ws: { ...binding(config), display: admission.display },
    checkedAt: now,
    token,
    exp: now + SESSION_LIFETIME_MS,
  };
  return redirect("/", [
    clearState,
    cookie(SESSION_COOKIE, await seal(claims, config), config, SESSION_LIFETIME_MS / 1000),
  ]);
}
