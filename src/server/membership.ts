// Who may sign in: one configured policy naming a kind and pinned numeric
// GitHub ids, resolved once during setup (scripts/membership-id.mjs). Names
// are display only; a rename never changes who is admitted.

export type Policy =
  | { readonly kind: "org"; readonly orgId: number }
  | { readonly kind: "team"; readonly orgId: number; readonly teamId: number }
  | { readonly kind: "user"; readonly userId: number };

export type Admission = { readonly ok: true; readonly display: string } | { readonly ok: false };

const ID = /^[1-9][0-9]{0,15}$/;

function id(value: string | undefined, what: string): number {
  if (!value || !ID.test(value)) throw new Error(`WORKBENCH_MEMBERSHIP: ${what} must be a numeric GitHub id`);
  return Number(value);
}

export function parsePolicy(value: string): Policy {
  const [kind, rest] = value.split(":", 2) as [string, string | undefined];
  switch (kind) {
    case "org":
      return { kind, orgId: id(rest, "the organization id") };
    case "team": {
      const [org, team] = (rest ?? "").split("/", 2);
      return { kind, orgId: id(org, "the organization id"), teamId: id(team, "the team id") };
    }
    case "user":
      return { kind, userId: id(rest, "the user id") };
    default:
      throw new Error("WORKBENCH_MEMBERSHIP must be org:<id>, team:<org id>/<team id> or user:<id>");
  }
}

/** The policy as configured, for cookie binding: the same string form as WORKBENCH_MEMBERSHIP. */
export function policyId(policy: Policy): string {
  switch (policy.kind) {
    case "org":
      return `org:${String(policy.orgId)}`;
    case "team":
      return `team:${String(policy.orgId)}/${String(policy.teamId)}`;
    case "user":
      return `user:${String(policy.userId)}`;
  }
}

const GITHUB = "https://api.github.com";

async function github(fetchImpl: typeof globalThis.fetch, token: string, path: string): Promise<unknown | null> {
  const response = await fetchImpl(`${GITHUB}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "opencomputer-workbench",
    },
    signal: AbortSignal.timeout(15_000),
  });
  // A revoked or expired token answers 401; that is "not admitted", not an outage.
  if (response.status === 401 || response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub answered ${String(response.status)} for ${path}`);
  return response.json();
}

async function pages(fetchImpl: typeof globalThis.fetch, token: string, path: string): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const body = await github(
      fetchImpl,
      token,
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${String(page)}`,
    );
    if (body === null) return all;
    if (!Array.isArray(body)) break;
    all.push(...body);
    if (body.length < 100) break;
  }
  return all;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Checks the token's user against the policy. Display names are read only for showing. */
export async function admit(token: string, policy: Policy, fetchImpl: typeof globalThis.fetch): Promise<Admission> {
  switch (policy.kind) {
    case "org": {
      const memberships = await pages(fetchImpl, token, "/user/memberships/orgs?state=active");
      for (const entry of memberships) {
        const membership = record(entry);
        const organization = record(membership?.organization);
        if (membership?.state === "active" && organization?.id === policy.orgId) {
          return { ok: true, display: text(organization.login) };
        }
      }
      return { ok: false };
    }
    case "team": {
      const teams = await pages(fetchImpl, token, "/user/teams");
      for (const entry of teams) {
        const team = record(entry);
        const organization = record(team?.organization);
        if (team?.id === policy.teamId && organization?.id === policy.orgId) {
          return { ok: true, display: `${text(organization.login)}/${text(team.slug) || text(team.name)}` };
        }
      }
      return { ok: false };
    }
    case "user": {
      const user = record(await github(fetchImpl, token, "/user"));
      return user?.id === policy.userId ? { ok: true, display: text(user.login) } : { ok: false };
    }
  }
}
