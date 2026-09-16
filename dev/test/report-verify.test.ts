import { describe, expect, it } from "vitest";
import type { Report } from "../../opencomputer/agents/worker/report.schema";
import { ReportRejected, verifyReport } from "../../opencomputer/agents/worker/tools/report";

const repo = "acme/service";
const base = "a".repeat(40);
const head = "b".repeat(40);
const other = "c".repeat(40);
const branch = "task/01J9Y0C6R4V3M2K7Q8N5P1H9ZT";
const url = "https://github.com/acme/service/pull/482";

type Route = (path: string) => { status: number; body?: unknown };

function gh(routes: Record<string, { status: number; body?: unknown }>): {
  fetch: typeof globalThis.fetch;
  calls: string[];
} {
  const calls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    const headers = new Headers(init?.headers);
    if (headers.get("authorization") !== "Bearer ghs_test") return new Response("{}", { status: 401 });
    const route = routes[url.pathname] ?? { status: 404, body: { message: "Not Found" } };
    return new Response(JSON.stringify(route.body ?? {}), { status: route.status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const github = () =>
  gh({
    [`/repos/${repo}/git/commits/${base}`]: { status: 200, body: { sha: base } },
    [`/repos/${repo}/git/commits/${head}`]: { status: 200, body: { sha: head } },
    [`/repos/${repo}/branches/${encodeURIComponent(branch)}`]: { status: 200, body: { commit: { sha: head } } },
    [`/repos/${repo}/pulls/482`]: {
      status: 200,
      body: { html_url: url, draft: true, head: { ref: branch, sha: head, repo: { full_name: repo } } },
    },
  });

const TOKEN = "ghs_test";

async function rejected(report: Report, fetch: typeof globalThis.fetch, token: string | undefined = TOKEN) {
  try {
    await verifyReport(report, fetch, token === "none" ? undefined : token);
  } catch (cause) {
    expect(cause).toBeInstanceOf(ReportRejected);
    return cause as ReportRejected;
  }
  throw new Error("expected a rejection");
}

describe("verifyReport", () => {
  it("returns an empty or checks-only report without calling GitHub", async () => {
    const { fetch, calls } = github();
    expect(await verifyReport({}, fetch, undefined)).toEqual({});
    const checks: Report = { checks: [{ command: "npm test", passed: true, summary: "41 passed" }] };
    expect(await verifyReport(checks, fetch, undefined)).toEqual(checks);
    expect(calls).toEqual([]);
  });

  it("requires the repository and a token once a git field is present", async () => {
    const { fetch } = github();
    expect((await rejected({ baseSha: base }, fetch)).field).toBe("repo");
    expect((await rejected({ repo, baseSha: base }, fetch, "none")).message).toMatch(/token/);
  });

  it("verifies only the fields present: the base alone, then the branch and commit, then the pull request", async () => {
    const { fetch, calls } = github();
    await verifyReport({ repo, baseSha: base }, fetch, "ghs_test");
    expect(calls).toEqual([`/repos/${repo}/git/commits/${base}`]);
    const full: Report = { repo, baseSha: base, branch, commit: head, pr: { number: 482, url, draft: true } };
    expect(await verifyReport(full, fetch, "ghs_test")).toEqual(full);
    expect(calls).toContain(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);
    expect(calls).toContain(`/repos/${repo}/pulls/482`);
  });

  it("rejects a commit that does not exist and a commit that is not the branch head", async () => {
    const { fetch } = github();
    expect((await rejected({ repo, commit: other }, fetch)).message).toMatch(/^commit: commit c+ does not exist/);
    const notHead = await rejected({ repo, branch, commit: base }, fetch);
    expect(notHead.field).toBe("commit");
    expect(notHead.message).toMatch(/not the head of task\//);
    expect((await rejected({ repo, branch: "task/missing" }, fetch)).message).toMatch(/push it first/);
  });

  it("rejects a pull request whose head is another branch, commit, repository, URL or draft state", async () => {
    const { fetch } = github();
    const pr = { number: 482, url, draft: true };
    const elsewhere = gh({
      [`/repos/${repo}/branches/${encodeURIComponent(branch)}`]: { status: 200, body: { commit: { sha: head } } },
      [`/repos/${repo}/pulls/482`]: {
        status: 200,
        body: { html_url: url, draft: true, head: { ref: "task/other", sha: other, repo: { full_name: repo } } },
      },
    });
    expect((await rejected({ repo, branch, pr }, elsewhere.fetch)).message).toMatch(/is from task\/other/);
    expect((await rejected({ repo, branch, commit: head, pr: { ...pr, draft: false } }, fetch)).message).toMatch(
      /a draft/,
    );
    expect(
      (await rejected({ repo, pr: { ...pr, url: "https://github.com/acme/service/pull/1" } }, fetch)).message,
    ).toMatch(/URL/);
    expect((await rejected({ repo, pr: { ...pr, number: 9 } }, fetch)).message).toMatch(/does not exist/);
    const forked = gh({
      [`/repos/${repo}/pulls/482`]: {
        status: 200,
        body: { html_url: url, draft: true, head: { ref: branch, sha: head, repo: { full_name: "someone/service" } } },
      },
    });
    expect((await rejected({ repo, pr }, forked.fetch)).message).toMatch(/comes from someone\/service/);
  });
});
