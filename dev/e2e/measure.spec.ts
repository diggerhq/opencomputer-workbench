// The measurement gate: proof that the interface is on one sizing system.
// On the list and on the completed task page it reads the rendered boxes
// and computed styles and asserts what one system implies: every control
// is one of shadcn's three heights, every visible border is one hairline in
// the one border color, every task row is the same height with its columns
// on the same edges, and the header, the composer and the list share a left
// edge. Fixture replay, desktop only: the assertions are about the system,
// not the data, and the mobile layout folds columns by design.
import { LIVE } from "./env";
import { LOG_SESSIONS } from "./fixture-server";
import { expect, test } from "./fixtures";

test.skip(LIVE, "the gate measures the fixture states");
test.skip(({ isMobile }) => Boolean(isMobile), "columns fold below md by design; the gate runs at 1440");

/** Heights a control may have: shadcn's default, sm and xs. */
const CONTROL_HEIGHTS = [24, 28, 32];

interface Box {
  readonly selector: string;
  readonly label: string;
  readonly left: number;
  readonly height: number;
}

interface Border {
  readonly label: string;
  readonly side: string;
  readonly width: number;
  readonly color: string;
}

const CONTROLS = 'button, input, textarea, [role="combobox"]';

/** The visible controls with their rendered heights, rounded to the pixel. */
async function controls(page: import("@playwright/test").Page): Promise<Box[]> {
  return page.evaluate((selector) => {
    const out: Box[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (element.closest("[hidden], [aria-hidden='true']")) continue;
      out.push({
        selector,
        label: `${element.tagName.toLowerCase()}${element.getAttribute("role") === "tab" ? "[tab]" : ""}${element.getAttribute("aria-label") ? `[${element.getAttribute("aria-label") ?? ""}]` : ""} "${(element.textContent ?? "").trim().slice(0, 24)}"`,
        left: Math.round(rect.left),
        height: Math.round(rect.height),
      });
    }
    return out;
  }, CONTROLS);
}

/** Every visible border on the page: its width and color per side, against the two colors the system allows. */
async function borders(page: import("@playwright/test").Page): Promise<{ allowed: string[]; found: Border[] }> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const resolve = (variable: string) => {
      probe.style.borderColor = `var(${variable})`;
      return getComputedStyle(probe).borderTopColor;
    };
    const allowed = [resolve("--border"), resolve("--input")];
    probe.remove();
    const found: Border[] = [];
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      for (const side of sides) {
        const width = Number.parseFloat(style[`border${side}Width`]);
        const color = style[`border${side}Color`];
        if (!width || style[`border${side}Style`] === "none") continue;
        // A transparent border is a layout reservation, not a visible line.
        if (/rgba?\([^)]*,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color) || color === "transparent") continue;
        found.push({
          label: `${element.tagName.toLowerCase()}.${String(element.className).split(" ").slice(0, 3).join(".")}`,
          side,
          width,
          color,
        });
      }
    }
    return { allowed, found };
  });
}

async function edges(page: import("@playwright/test").Page, selector: string): Promise<number[]> {
  return page.evaluate(
    (query) =>
      [...document.querySelectorAll<HTMLElement>(query)].map((element) =>
        Math.round(element.getBoundingClientRect().left),
      ),
    selector,
  );
}

async function heights(page: import("@playwright/test").Page, selector: string): Promise<number[]> {
  return page.evaluate(
    (query) =>
      [...document.querySelectorAll<HTMLElement>(query)].map((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    selector,
  );
}

function assertControls(boxes: Box[]) {
  // shadcn's tab trigger is its list's height minus the list's padding and a
  // hairline, one pixel under the scale by the library's own design; tabs are
  // held to one shared height instead.
  const tabs = boxes.filter((box) => box.label.startsWith("button[tab]"));
  expect(
    new Set(tabs.map((box) => box.height)).size,
    `tab heights ${tabs.map((b) => b.height).join(", ")}`,
  ).toBeLessThan(2);
  const wrong = boxes.filter((box) => {
    if (box.label.startsWith("button[tab]")) return false;
    if (box.label.startsWith("textarea")) return box.height % 4 !== 0;
    return !CONTROL_HEIGHTS.includes(box.height);
  });
  expect(
    wrong,
    `controls off the scale: ${wrong.map((box) => `${box.label} ${String(box.height)}px`).join("; ")}`,
  ).toEqual([]);
}

function assertBorders(result: { allowed: string[]; found: Border[] }) {
  const wrong = result.found.filter((border) => border.width !== 1 || !result.allowed.includes(border.color));
  expect(
    wrong,
    `borders off the system (allowed ${result.allowed.join(" | ")}): ${wrong
      .slice(0, 12)
      .map((border) => `${border.label} ${border.side} ${String(border.width)}px ${border.color}`)
      .join("; ")}`,
  ).toEqual([]);
  expect(result.found.length).toBeGreaterThan(0);
}

test.describe("the list", () => {
  test("controls, borders, rows and edges", async ({ page, member: _member }) => {
    await page.goto("/");
    await expect(page.getByText("That's every task")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    assertControls(await controls(page));
    assertBorders(await borders(page));

    // Every row the same height, every column on the same edge.
    const rows = await heights(page, '[data-slot="task-row"]');
    expect(rows.length).toBeGreaterThan(5);
    expect(new Set(rows).size, `row heights ${rows.join(", ")}`).toBe(1);
    for (const column of ["status", "title", "stage"]) {
      const lefts = await edges(page, `[data-slot="task-row"] [data-col="${column}"]`);
      expect(lefts.length).toBe(rows.length);
      expect(new Set(lefts).size, `${column} column edges ${lefts.join(", ")}`).toBe(1);
    }

    // The header's content, the composer card and the list panel share a left edge.
    const [header] = await edges(page, '[data-slot="brand"]');
    const [composer] = await edges(page, '[data-slot="composer"]');
    const [list] = await edges(page, '[data-slot="task-list"]');
    expect(composer, `composer ${String(composer)} vs header ${String(header)}`).toBe(header);
    expect(list, `list ${String(list)} vs header ${String(header)}`).toBe(header);
  });
});

test.describe("the completed task page", () => {
  test("controls, borders and the two columns' top edge", async ({ page, member: _member }) => {
    await page.goto(`/tasks/${LOG_SESSIONS.completed ?? ""}`);
    await expect(page.getByText("Loading the conversation…")).toBeHidden();
    await expect(page.getByLabel("Loading activity")).toBeHidden();
    await expect(page.getByRole("region", { name: "Result" }).or(page.getByLabel("Result"))).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    assertControls(await controls(page));
    assertBorders(await borders(page));

    // The page's content shares the header's left edge; the two columns start on one line.
    const [header] = await edges(page, '[data-slot="brand"]');
    const [main] = await edges(page, "main");
    expect(main).toBe(header);
    const tops = await page.evaluate(() => {
      const request = document.querySelector('[aria-label="Request"]');
      const activity = document.querySelector('[data-slot="activity"]');
      return [request, activity].map((element) => Math.round(element?.getBoundingClientRect().top ?? -1));
    });
    expect(tops[0]).toBeGreaterThan(0);
    expect(tops[1], `request top ${String(tops[0])} vs activity top ${String(tops[1])}`).toBe(tops[0]);
  });
});
