// Signs the tests in the way the app itself does: the session cookie is
// minted with the app's own `seal()` and the cookie key from the
// environment, bound to the workspace the app is configured for, never by
// walking through GitHub. Also the screenshot helper and the fixture
// server's control calls.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type BrowserContext, test as base, type Page } from "@playwright/test";
import { SESSION_COOKIE, type SessionClaims, seal } from "../../src/server/auth";
import { policyId } from "../../src/server/membership";
import { BASE_URL, cookieConfig, FIXTURE_PORT, LIVE } from "./env";

const HOUR = 60 * 60 * 1000;

/** The signed-in member: fixed for replay, from E2E_USER_ID and E2E_LOGIN on a live target. */
export const MEMBER = {
  id: Number(process.env.E2E_USER_ID ?? "1"),
  login: process.env.E2E_LOGIN ?? "jdoe",
};

export async function sessionCookie(): Promise<{ name: string; value: string }> {
  const config = cookieConfig();
  const now = Date.now();
  const claims: SessionClaims = {
    uid: MEMBER.id,
    login: MEMBER.login,
    avatar: "",
    ws: {
      policy: policyId(config.membership),
      display: process.env.E2E_MEMBERSHIP_DISPLAY ?? "acme/platform",
      project: config.oc.projectId,
      environment: config.oc.environment,
    },
    checkedAt: now,
    token: process.env.E2E_GITHUB_TOKEN ?? "fixture-token",
    exp: now + 24 * HOUR,
  };
  return { name: SESSION_COOKIE, value: await seal(claims, config) };
}

/** A 1×1 transparent PNG, served in place of GitHub avatars so captures never wait on the network. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function offline(context: BrowserContext): Promise<void> {
  await context.route("https://avatars.githubusercontent.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
}

export interface Fixture {
  /** Sets the list scenario on the fixture server; no-op on a live target. */
  list(scenario: "all" | "empty" | "error"): Promise<void>;
  /** Restores the fixture server's initial state; no-op on a live target. */
  reset(): Promise<void>;
}

async function control(path: string, body?: unknown): Promise<void> {
  if (LIVE) return;
  const response = await fetch(`http://localhost:${String(FIXTURE_PORT)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(`fixture server answered ${String(response.status)} for ${path}`);
}

export const test = base.extend<{ member: undefined; fixture: Fixture }>({
  // A signed-in member for the whole context; tests of the sign-in screen do not use it.
  member: [
    async ({ context }, use) => {
      const cookie = await sessionCookie();
      const url = new URL(BASE_URL);
      await context.addCookies([
        {
          name: cookie.name,
          value: cookie.value,
          domain: url.hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
          secure: url.protocol === "https:",
        },
      ]);
      await offline(context);
      await use(undefined);
    },
    { auto: false },
  ],
  fixture: async ({ context }, use) => {
    await offline(context);
    await use({ list: (scenario) => control("/__scenario", { list: scenario }), reset: () => control("/__reset") });
    await control("/__reset");
  },
});

export { expect } from "@playwright/test";

export type Theme = "light" | "dark";

/**
 * Writes `dev/design/screens/app/<name>-<viewport>-<theme>.png`. Animations are
 * disabled so the working dot and the streaming caret are captured in their
 * resting state; full page unless told otherwise.
 */
export async function capture(page: Page, name: string, theme: Theme, options: { fullPage?: boolean } = {}) {
  const width = page.viewportSize()?.width ?? 0;
  const dir = process.env.SCREENSHOT_DIR ?? fileURLToPath(new URL("../design/screens/app", import.meta.url));
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${name}-${String(width)}-${theme}.png`,
    fullPage: options.fullPage ?? true,
    animations: "disabled",
    caret: "hide",
  });
}

/** Switches the page to a theme through the system preference, which the app follows. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  const dark = theme === "dark";
  await page.waitForFunction((expected) => document.documentElement.classList.contains("dark") === expected, dark);
}

/** Captures a page in both themes. */
export async function captureBoth(page: Page, name: string, options: { fullPage?: boolean } = {}): Promise<void> {
  await setTheme(page, "light");
  await capture(page, name, "light", options);
  await setTheme(page, "dark");
  await capture(page, name, "dark", options);
}
