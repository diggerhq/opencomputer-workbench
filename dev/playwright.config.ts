// The screenshot loop over the real application. By default Playwright
// starts the app itself (`vite dev` on a strict port) with fixture values in
// its environment and OPENCOMPUTER_API_URL pointing at the fixture server,
// which the global setup starts; the specs render every state from the
// recordings under dev/fixtures and write their captures to dev/design/screens/app.
// With BASE_URL and OPENCOMPUTER_API_URL set in the environment the same
// suite targets a live workbench instead: nothing is started here, the cookie
// is minted from that environment's key, and the live-only specs run.
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, BASE_URL, FIXTURE_ENV, LIVE } from "./e2e/env";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One worker: the fixture server's scenario is shared state for the run.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: LIVE ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "off",
  },
  webServer: LIVE
    ? undefined
    : {
        command: `npx vite dev --port ${String(APP_PORT)} --strictPort`,
        // The app lives at the repository root, one level above this configuration.
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        url: `http://localhost:${String(APP_PORT)}/`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: FIXTURE_ENV,
      },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "mobile",
      // Chromium with a phone viewport: one browser to install, the same layout rules.
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        // 1.5x, not the device's 2.625x: readable captures inside the size budget.
        deviceScaleFactor: 1.5,
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
      },
    },
  ],
});
