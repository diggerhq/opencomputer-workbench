// The two targets the suite runs against. Fixture replay is the default: the
// real app on a strict port, configured entirely from the values below and
// pointed at the fixture server. A live target (Development) is selected by
// BASE_URL and OPENCOMPUTER_API_URL in the environment; the cookie is then
// minted from the same environment's WORKBENCH_COOKIE_KEY, membership,
// project and environment, which must be the deployed workbench's own.
import { type Config, readConfig } from "../src/server/env";

/** The replay's two ports; APP_PORT and FIXTURE_PORT in the environment move them, so a second run can sit beside a walkthrough. */
export const APP_PORT = Number(process.env.APP_PORT ?? 3201);
export const FIXTURE_PORT = Number(process.env.FIXTURE_PORT ?? 3202);

export const LIVE = Boolean(process.env.BASE_URL);
export const BASE_URL = process.env.BASE_URL ?? `http://localhost:${String(APP_PORT)}`;

/**
 * Fixture values only: a test key and placeholder credentials that reach
 * nothing. They live here, not in an env file, and the app reads them from
 * the webServer's environment.
 */
export const FIXTURE_ENV: Record<string, string> = {
  OPENCOMPUTER_API_KEY: "fixture-key",
  OPENCOMPUTER_API_URL: `http://localhost:${String(FIXTURE_PORT)}`,
  OPENCOMPUTER_PROJECT_ID: "proj_1",
  OPENCOMPUTER_ENVIRONMENT: "development",
  OPENCOMPUTER_AGENT_ID: "worker",
  GITHUB_CLIENT_ID: "fixture-client",
  GITHUB_CLIENT_SECRET: "fixture-secret",
  WORKBENCH_COOKIE_KEY: Buffer.alloc(32, 7).toString("base64"),
  WORKBENCH_MEMBERSHIP: "team:100/200",
  WORKBENCH_ORIGIN: `http://localhost:${String(APP_PORT)}`,
};

/** The configuration the cookie is sealed against: the fixture values, or the live workbench's. */
export function cookieConfig(): Config {
  return readConfig(LIVE ? process.env : FIXTURE_ENV);
}
