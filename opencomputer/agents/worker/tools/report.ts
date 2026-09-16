// The report tool: the shape check on what the model sent, the verification
// of the fields present against GitHub with the installation token the
// connection places in the sandbox, and the tool itself, declared to the
// model with the schema from ../report.schema. A claim that does not hold
// fails the call to the model with the reason. `checks` is never verified:
// it stays the agent's claim, tied to the command it names.
import { type DataValue, defineTool } from "@opencomputer/agent";
import { REPORT_JSON_SCHEMA, type Report } from "../report.schema";

export class ReportRejected extends Error {
  constructor(
    readonly field: keyof Report,
    reason: string,
  ) {
    super(`${field}: ${reason}`);
    this.name = "ReportRejected";
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const SHA_PATTERN = new RegExp(REPORT_JSON_SCHEMA.properties.commit.pattern);
const REPO_PATTERN = new RegExp(REPORT_JSON_SCHEMA.properties.repo.pattern);

/**
 * The shape check the tool runs on what the model sent, against the schema
 * above, before anything touches GitHub. The app parses the same schema
 * with zod; here, inside the agent directory, the check is written out.
 */
export function parseReport(input: unknown): Report {
  const value = record(input);
  if (!value) throw new ReportRejected("repo", "the report must be an object");
  const known = new Set(Object.keys(REPORT_JSON_SCHEMA.properties));
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw new ReportRejected(key as keyof Report, "is not a field of the report");
  }
  const text = (field: keyof Report, pattern?: RegExp, max?: number) => {
    const entry = value[field];
    if (entry === undefined) return undefined;
    if (typeof entry !== "string" || !entry) throw new ReportRejected(field, "must be a non-empty string");
    if (pattern && !pattern.test(entry)) throw new ReportRejected(field, `does not match ${pattern.source}`);
    if (max !== undefined && entry.length > max) throw new ReportRejected(field, `is longer than ${String(max)}`);
    return entry;
  };
  const report: Record<string, unknown> = {};
  const repo = text("repo", REPO_PATTERN);
  if (repo !== undefined) report.repo = repo;
  const baseSha = text("baseSha", SHA_PATTERN);
  if (baseSha !== undefined) report.baseSha = baseSha;
  const branch = text("branch", undefined, 255);
  if (branch !== undefined) report.branch = branch;
  const commit = text("commit", SHA_PATTERN);
  if (commit !== undefined) report.commit = commit;
  if (value.pr !== undefined) {
    const pr = record(value.pr);
    if (
      !pr ||
      typeof pr.number !== "number" ||
      !Number.isInteger(pr.number) ||
      pr.number < 1 ||
      typeof pr.url !== "string" ||
      !/^https?:\/\//.test(pr.url) ||
      typeof pr.draft !== "boolean" ||
      Object.keys(pr).some((key) => !["number", "url", "draft"].includes(key))
    ) {
      throw new ReportRejected("pr", "must be { number, url, draft }");
    }
    report.pr = { number: pr.number, url: pr.url, draft: pr.draft };
  }
  if (value.checks !== undefined) {
    if (!Array.isArray(value.checks) || value.checks.length > 10) {
      throw new ReportRejected("checks", "must be an array of at most 10 checks");
    }
    report.checks = value.checks.map((entry) => {
      const check = record(entry);
      if (
        !check ||
        typeof check.command !== "string" ||
        !check.command ||
        check.command.length > 200 ||
        typeof check.passed !== "boolean" ||
        typeof check.summary !== "string" ||
        check.summary.length > 200 ||
        Object.keys(check).some((key) => !["command", "passed", "summary"].includes(key))
      ) {
        throw new ReportRejected("checks", "each check must be { command, passed, summary }");
      }
      return { command: check.command, passed: check.passed, summary: check.summary };
    });
  }
  return report as Report;
}

const GITHUB = "https://api.github.com";

async function github(
  fetchImpl: typeof globalThis.fetch,
  token: string,
  path: string,
): Promise<{ status: number; body: Record<string, unknown> | undefined }> {
  const response = await fetchImpl(`${GITHUB}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "opencomputer-workbench-worker",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  return { status: response.status, body };
}

/**
 * Checks the fields present in a report against GitHub and nothing else.
 * `baseSha` and `commit` must exist in the repository; `commit` must be the
 * head of `branch`, which proves the branch was pushed; `pr` must exist and
 * its head must be the work branch at the reported commit, its base being
 * whatever it is. `checks` is not verified. Throws `ReportRejected` naming
 * the field and the reason; returns the report unchanged when it holds.
 */
export async function verifyReport(
  report: Report,
  fetchImpl: typeof globalThis.fetch,
  token: string | undefined,
): Promise<Report> {
  const { repo, baseSha, branch, commit, pr } = report;
  if (baseSha === undefined && branch === undefined && commit === undefined && pr === undefined) return report;
  if (!repo) throw new ReportRejected("repo", "required to verify the other fields; report it as owner/name");
  if (!token) throw new ReportRejected("repo", "no GitHub installation token is available in this computer");

  const commitExists = async (field: "baseSha" | "commit", value: string) => {
    const { status } = await github(fetchImpl, token, `/repos/${repo}/git/commits/${value}`);
    if (status === 404) throw new ReportRejected(field, `commit ${value} does not exist in ${repo}`);
    if (status !== 200) throw new ReportRejected(field, `GitHub answered ${String(status)} for commit ${value}`);
  };
  if (baseSha !== undefined) await commitExists("baseSha", baseSha);
  if (commit !== undefined) await commitExists("commit", commit);

  if (branch !== undefined) {
    const { status, body } = await github(fetchImpl, token, `/repos/${repo}/branches/${encodeURIComponent(branch)}`);
    if (status === 404) throw new ReportRejected("branch", `branch ${branch} does not exist in ${repo}; push it first`);
    if (status !== 200) throw new ReportRejected("branch", `GitHub answered ${String(status)} for branch ${branch}`);
    const head = record(body?.commit)?.sha;
    if (commit !== undefined && head !== commit) {
      throw new ReportRejected(
        "commit",
        `${commit} is not the head of ${branch} (the head is ${typeof head === "string" ? head : "unknown"}); push, then report the pushed commit`,
      );
    }
  }

  if (pr !== undefined) {
    const { status, body } = await github(fetchImpl, token, `/repos/${repo}/pulls/${String(pr.number)}`);
    if (status === 404) throw new ReportRejected("pr", `pull request #${String(pr.number)} does not exist in ${repo}`);
    if (status !== 200) {
      throw new ReportRejected("pr", `GitHub answered ${String(status)} for pull request #${String(pr.number)}`);
    }
    const head = record(body?.head);
    const headRepo = record(head?.repo)?.full_name;
    if (typeof headRepo === "string" && headRepo.toLowerCase() !== repo.toLowerCase()) {
      throw new ReportRejected("pr", `pull request #${String(pr.number)} comes from ${headRepo}, not ${repo}`);
    }
    if (branch !== undefined && head?.ref !== branch) {
      throw new ReportRejected("pr", `pull request #${String(pr.number)} is from ${String(head?.ref)}, not ${branch}`);
    }
    if (commit !== undefined && head?.sha !== commit) {
      throw new ReportRejected(
        "pr",
        `pull request #${String(pr.number)} is at ${String(head?.sha)}, not the reported commit ${commit}; push, then report`,
      );
    }
    if (typeof body?.html_url === "string" && body.html_url !== pr.url) {
      throw new ReportRejected("pr", `the URL of pull request #${String(pr.number)} is ${body.html_url}`);
    }
    if (typeof body?.draft === "boolean" && body.draft !== pr.draft) {
      throw new ReportRejected("pr", `pull request #${String(pr.number)} is ${body.draft ? "" : "not "}a draft`);
    }
  }
  return report;
}

export const report = defineTool({
  name: "report",
  description:
    "Record what is known about the task so far: the repository, the resolved base commit, the work branch, the tested commit, the pull request and the checks that ran. Call it as soon as the base commit is known and again whenever one of these changes, each call carrying everything known so far. Git references are verified against GitHub; a claim that does not hold is rejected with the reason.",
  input: REPORT_JSON_SCHEMA,
  output: REPORT_JSON_SCHEMA,
  result: true,
  async run({ input }) {
    const verified = await verifyReport(
      parseReport(input),
      globalThis.fetch,
      process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
    );
    return verified as unknown as DataValue;
  },
});
