// Typed configuration. Each host passes its own source (Worker bindings,
// process.env) and gets back an immutable Config or an Error naming the
// missing key. Values never appear in errors.
import { type Policy, parsePolicy } from "./membership";

export type Environment = "development" | "production";

export interface Config {
  readonly oc: {
    readonly apiKey: string;
    /** The OpenComputer origin; the management API lives under /api/managed-agents. */
    readonly origin: string;
    readonly projectId: string;
    readonly environment: Environment;
    readonly agentId: string;
  };
  readonly github: { readonly clientId: string; readonly clientSecret: string };
  /** 32 bytes for the cookie's authenticated encryption. */
  readonly cookieKey: Uint8Array;
  readonly membership: Policy;
  /** The app's public origin: the OAuth callback and the origin check. */
  readonly origin: string;
  /** Development stubs are enabled only by the literal "1". */
  readonly devStubs: boolean;
}

export type ConfigSource = Readonly<Record<string, string | undefined>>;

const KEYS = [
  "OPENCOMPUTER_API_KEY",
  "OPENCOMPUTER_PROJECT_ID",
  "OPENCOMPUTER_ENVIRONMENT",
  "OPENCOMPUTER_AGENT_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "WORKBENCH_COOKIE_KEY",
  "WORKBENCH_MEMBERSHIP",
  "WORKBENCH_ORIGIN",
] as const;

function required(source: ConfigSource, key: (typeof KEYS)[number]): string {
  const value = source[key]?.trim();
  if (!value) throw new Error(`Missing configuration: ${key}`);
  return value;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function origin(key: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute URL`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${key} must be an origin without a path`);
  }
  return url.origin;
}

export function readConfig(source: ConfigSource): Config {
  const environment = required(source, "OPENCOMPUTER_ENVIRONMENT");
  if (environment !== "development" && environment !== "production") {
    throw new Error("OPENCOMPUTER_ENVIRONMENT must be development or production");
  }
  let cookieKey: Uint8Array;
  try {
    cookieKey = decodeBase64(required(source, "WORKBENCH_COOKIE_KEY"));
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Missing configuration")) throw cause;
    throw new Error("WORKBENCH_COOKIE_KEY must be base64");
  }
  if (cookieKey.length !== 32) throw new Error("WORKBENCH_COOKIE_KEY must be base64 of 32 bytes");
  return Object.freeze({
    oc: Object.freeze({
      apiKey: required(source, "OPENCOMPUTER_API_KEY"),
      origin: origin("OPENCOMPUTER_API_URL", source.OPENCOMPUTER_API_URL?.trim() || "https://app.opencomputer.dev"),
      projectId: required(source, "OPENCOMPUTER_PROJECT_ID"),
      environment,
      agentId: required(source, "OPENCOMPUTER_AGENT_ID"),
    }),
    github: Object.freeze({
      clientId: required(source, "GITHUB_CLIENT_ID"),
      clientSecret: required(source, "GITHUB_CLIENT_SECRET"),
    }),
    cookieKey,
    membership: parsePolicy(required(source, "WORKBENCH_MEMBERSHIP")),
    origin: origin("WORKBENCH_ORIGIN", required(source, "WORKBENCH_ORIGIN")),
    devStubs: source.WORKBENCH_DEV_STUBS === "1",
  });
}
