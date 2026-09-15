// The live acceptance run against a deployed workbench and its Development
// environment: sign in, list, open a task, send a follow-up, stop. It runs
// only when BASE_URL and OPENCOMPUTER_API_URL name a live target; never in
// CI, never on the fixture server. The cookie is minted from that
// environment's WORKBENCH_COOKIE_KEY, membership, project and environment,
// which must be the deployed workbench's own; E2E_LOGIN and E2E_USER_ID
// name the member it signs in as.
import { LIVE } from "./env";
import { expect, test } from "./fixtures";

test.skip(!LIVE, "runs only against a live target: set BASE_URL and OPENCOMPUTER_API_URL");
test.describe.configure({ mode: "serial" });
test.setTimeout(5 * 60_000);

test("signs in, lists the workspace's tasks, opens one, follows up and stops", async ({ page, member: _member }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Workbench" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Active/ })).toBeVisible();
  await expect(page.getByText("That's every task").or(page.getByRole("button", { name: "Load more" }))).toBeVisible();

  const rows = page.getByRole("list").getByRole("listitem");
  if ((await rows.count()) === 0) {
    test.skip(true, "the live workspace has no task to open; start one from the composer first");
  }
  await rows.first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.getByText("Loading the conversation…")).toBeHidden();

  const followUp = "Reply with the single word ready, then keep waiting for instructions.";
  await page.getByRole("textbox", { name: "Follow up" }).fill(followUp);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("region", { name: "Conversation" })).toContainText(followUp);

  const stop = page.getByRole("button", { name: /^Stop/ });
  await expect(stop).toBeEnabled({ timeout: 2 * 60_000 });
  await stop.click();
  await expect(stop).toHaveText("Stopping…");
  await expect(page.getByText("Stopped", { exact: true }).or(stop.and(page.locator(":disabled")))).toBeVisible({
    timeout: 2 * 60_000,
  });
});
