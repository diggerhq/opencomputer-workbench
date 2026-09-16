// Every visual state of the two screens, rendered by the real application
// from the recordings the fixture server replays, captured at both viewports
// in both themes into design/screens/app. Each capture is preceded by the
// assertion that names the state, so a failing state fails here before it
// produces a misleading picture. Fixture-only: the states are the fixtures'.
import { LIVE } from "./env";
import { LOG_SESSIONS } from "./fixture-server";
import { captureBoth, expect, test } from "./fixtures";

test.skip(LIVE, "the state captures are fixture-specific; live.spec.ts covers a live target");

async function settled(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByText("Loading the conversation…")).toBeHidden();
  await expect(page.getByLabel("Loading activity")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
}

test.describe("the sign-in screen", () => {
  test("without a cookie", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await captureBoth(page, "sign-in", { fullPage: false });
  });
});

test.describe("the task list", () => {
  test("every row state", async ({ page, member: _member }) => {
    await page.goto("/");
    await expect(page.getByRole("tab", { name: /^Active \(\d+\)$/ })).toBeVisible();
    await expect(page.getByText("That's every task")).toBeVisible();
    await expect(page.getByText("Working, 2 queued").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Ready for review").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Not started").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Stopping").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Starting").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Ended").filter({ visible: true }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await captureBoth(page, "list");
    await page.getByRole("tab", { name: "Archived" }).click();
    await expect(page.getByText("Spike: try the new bundler")).toBeVisible();
    await expect(page.getByText("That's every task")).toBeVisible();
    await captureBoth(page, "list-archived");
  });

  test("empty", async ({ page, member: _member, fixture }) => {
    await fixture.list("empty");
    await page.goto("/");
    await expect(page.getByText("No tasks yet. Describe one above to start.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await captureBoth(page, "list-empty", { fullPage: false });
  });
});

test.describe("the task page", () => {
  test("created-only: a session with no admitted turn", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS["created-only"] ?? ""}`);
    await expect(page.getByText("The request has not been admitted yet.")).toBeVisible();
    await expect(page.getByText("Nothing has run yet.")).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-created-only");
  });

  test("working: a running first turn with a streaming reply", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS.working ?? ""}`);
    await expect(page.getByText("Working", { exact: true })).toBeVisible();
    await expect(page.getByText("running", { exact: true })).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-working");
  });

  test("completed: the recorded first run, a published report after two rejected ones", async ({
    page,
    member: _member,
  }) => {
    await page.goto(`/tasks/${LOG_SESSIONS.completed ?? ""}`);
    await expect(page.getByText("reported by turn 1")).toBeVisible();
    await expect(page.getByText("published", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Turn 1" })).toBeVisible();
    await expect(page.getByText("#19 draft")).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-completed");
  });

  test("turn-failed-runtime-lost: the runtime lost under a command", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS["turn-failed-runtime-lost"] ?? ""}`);
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await expect(page.getByText("runtime_lost").first()).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-turn-failed-runtime-lost");
  });

  test("cancelled: a stop during a long command, then a completed follow-up", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS.cancelled ?? ""}`);
    await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Turn 2" })).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-cancelled");
  });

  test("tool-timed-out: a command hits the limit inside a turn that continues", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS["tool-timed-out"] ?? ""}`);
    await expect(page.getByText(/^timed out/)).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-tool-timed-out");
  });

  test("tool-failed: the report tool rejects a claim and the agent reports again", async ({
    page,
    member: _member,
  }) => {
    await page.goto(`/tasks/${LOG_SESSIONS["tool-failed"] ?? ""}`);
    await expect(page.getByText("failed", { exact: true })).toBeVisible();
    await expect(page.getByText("reported by turn 1")).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-tool-failed");
  });

  test("ended: a completed turn, then the owner ended the session", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS.ended ?? ""}`);
    await expect(page.getByText("This task has ended.")).toBeVisible();
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();
    await settled(page);
    await captureBoth(page, "task-ended");
  });

  test("not found", async ({ page, member: _member }) => {
    await page.goto("/tasks/00000000-0000-4000-8000-00000000dead");
    await expect(page.getByRole("alert")).toHaveText("No such task.");
    await page.evaluate(() => document.fonts.ready);
    await captureBoth(page, "not-found", { fullPage: false });
  });

  test("the End dialog", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS["tool-failed"] ?? ""}`);
    await settled(page);
    const end = page.getByRole("button", { name: "End", exact: true });
    await expect(end).toBeEnabled();
    await end.click();
    await expect(page.getByRole("alertdialog")).toContainText("End this task?");
    await captureBoth(page, "end-dialog", { fullPage: false });
  });
});
