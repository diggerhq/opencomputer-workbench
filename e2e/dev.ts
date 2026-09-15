// Walk through the workbench locally over the recorded fixtures, for looking
// rather than testing: the fixture server replays the management API from
// fixtures/, the real application runs against it on its usual port, and a
// browser opens already signed in as the fixture member. Resize the window
// to 390 and 1440; flip the system theme for dark mode. Nothing here touches
// OpenComputer or GitHub.
//
// The fixture values win over .env.local (the app's dev entry never
// overrides a variable the environment already set), with one exception:
// when .env.local carries a GitHub OAuth app and a membership rule, those
// three are used, so a real sign-in through GitHub works in any browser at
// the same URL.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "@playwright/test";
import { SESSION_COOKIE, type SessionClaims, seal } from "../src/server/auth";
import { readConfig } from "../src/server/env";
import { policyId } from "../src/server/membership";
import { APP_PORT, FIXTURE_ENV, FIXTURE_PORT } from "./env";
import { fixtureApp, initialState, listen } from "./fixture-server";

const ORIGIN = `http://localhost:${String(APP_PORT)}`;
const REAL_SIGN_IN = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "WORKBENCH_MEMBERSHIP"] as const;
const MEMBER = { id: 1, login: "jdoe", display: "acme/platform" };
/** `--no-browser`: keep the servers up and hand the sign-in to a browser you already have open. */
const NO_BROWSER = process.argv.includes("--no-browser") || process.env.WALKTHROUGH_BROWSER === "0";

function environment(): { env: Record<string, string>; realSignIn: boolean } {
  const env = { ...FIXTURE_ENV };
  if (!existsSync(".env.local")) return { env, realSignIn: false };
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  const values = REAL_SIGN_IN.map((key) => local[key]?.trim()).filter((value): value is string => Boolean(value));
  if (values.length !== REAL_SIGN_IN.length) return { env, realSignIn: false };
  for (const [index, key] of REAL_SIGN_IN.entries()) env[key] = values[index] as string;
  return { env, realSignIn: true };
}

async function cookie(env: Record<string, string>): Promise<string> {
  const config = readConfig(env);
  const now = Date.now();
  const claims: SessionClaims = {
    uid: MEMBER.id,
    login: MEMBER.login,
    avatar: "",
    ws: {
      policy: policyId(config.membership),
      display: MEMBER.display,
      project: config.oc.projectId,
      environment: config.oc.environment,
    },
    checkedAt: now,
    token: "fixture-token",
    exp: now + 24 * 60 * 60 * 1000,
  };
  return seal(claims, config);
}

async function waitFor(url: string, headers: Record<string, string>, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url, { headers });
      if (response.status !== 502 && response.status !== 503) return response.status;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`${url} did not answer within ${String(timeoutMs / 1000)} s`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function main(): Promise<void> {
  const { env, realSignIn } = environment();
  const fixtures = await listen(fixtureApp(initialState()), FIXTURE_PORT);
  const vite = spawn("npx", ["vite", "dev", "--port", String(APP_PORT), "--strictPort"], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
  });
  let stopping = false;
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    vite.kill();
    fixtures.close(() => process.exit(code));
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  vite.on("exit", (code) => stop(code ?? 1));

  const session = await cookie(env);
  const status = await waitFor(`${ORIGIN}/api/workspace`, { cookie: `${SESSION_COOKIE}=${session}` }, 60_000);
  if (status !== 200) throw new Error(`/api/workspace answered ${String(status)} for the fixture member`);
  console.log(`\nWorkbench over fixtures: ${ORIGIN}`);
  console.log(`Signed in as ${MEMBER.login} (${MEMBER.display}) in the browser that opens now.`);
  if (realSignIn) console.log("A real GitHub sign-in also works at that URL, from .env.local's OAuth app.");
  console.log(
    `List states: curl -X POST localhost:${String(FIXTURE_PORT)}/__scenario -H 'content-type: application/json' -d '{"list":"empty"}'  (all | empty | error)`,
  );
  if (NO_BROWSER) {
    // The cookie is sealed against fixture values only; a file keeps it out of the terminal scrollback.
    const snippet = join(tmpdir(), "opencomputer-workbench-sign-in.js");
    writeFileSync(
      snippet,
      `document.cookie = ${JSON.stringify(`${SESSION_COOKIE}=${session}; Path=/; SameSite=Lax`)}; location.reload();\n`,
      { mode: 0o600 },
    );
    console.log(
      `No browser opened. Open ${ORIGIN} in yours, paste the contents of ${snippet} into its DevTools console:`,
    );
    console.log(`  pbcopy < ${snippet}`);
    console.log("Press Ctrl-C to stop.\n");
    return;
  }
  console.log("Close the browser window or press Ctrl-C to stop.\n");

  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (cause) {
    console.error("Chromium is not installed for Playwright; run: npx playwright install chromium");
    console.error(cause instanceof Error ? cause.message : String(cause));
    stop(1);
    return;
  }
  const context = await browser.newContext({ viewport: null });
  await context.addCookies([{ name: SESSION_COOKIE, value: session, url: ORIGIN, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(ORIGIN);
  browser.on("disconnected", () => stop(0));
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
});
