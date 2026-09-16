#!/usr/bin/env node
// Resolves the workspace membership rule to pinned numeric GitHub ids once,
// during setup, with the GitHub CLI's own login:
//   npm run membership-id -- org:acme
//   npm run membership-id -- team:acme/platform
//   npm run membership-id -- user:octocat
// It prints the WORKBENCH_MEMBERSHIP line to put in the configuration. Ids
// are never resolved again at startup, so a rename cannot change who is
// admitted.
import { execFileSync } from "node:child_process";

function gh(path) {
  try {
    return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (cause) {
    const detail = cause.stderr ? String(cause.stderr).trim() : cause.message;
    console.error(`gh api ${path} failed: ${detail}`);
    process.exit(1);
  }
}

const [rule] = process.argv.slice(2);
const [kind, rest] = rule ? rule.split(":", 2) : [];
let line;
switch (kind) {
  case "org": {
    const org = gh(`orgs/${encodeURIComponent(rest)}`);
    line = `WORKBENCH_MEMBERSHIP=org:${org.id}`;
    console.error(`organization ${org.login} (id ${org.id})`);
    break;
  }
  case "team": {
    const [orgName, slug] = (rest ?? "").split("/", 2);
    if (!orgName || !slug) break;
    const org = gh(`orgs/${encodeURIComponent(orgName)}`);
    const team = gh(`orgs/${encodeURIComponent(orgName)}/teams/${encodeURIComponent(slug)}`);
    line = `WORKBENCH_MEMBERSHIP=team:${org.id}/${team.id}`;
    console.error(`team ${org.login}/${team.slug} (organization ${org.id}, team ${team.id})`);
    break;
  }
  case "user": {
    const user = gh(`users/${encodeURIComponent(rest)}`);
    line = `WORKBENCH_MEMBERSHIP=user:${user.id}`;
    console.error(`user ${user.login} (id ${user.id})`);
    break;
  }
  default:
    break;
}
if (!line) {
  console.error("usage: npm run membership-id -- org:<login> | team:<org>/<slug> | user:<login>");
  process.exit(2);
}
console.log(line);
