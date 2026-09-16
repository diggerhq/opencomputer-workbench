// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskRow } from "../../../src/components/TaskRow";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import type { SessionSummary } from "../../../src/server/client";
import { toTask } from "../../../src/server/task";
import type { Task } from "../../../src/shared/task";

const ROWS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "rows");
const NOW = Date.parse("2026-09-15T20:46:00.000Z");

function task(name: string): Task {
  return toTask(JSON.parse(readFileSync(join(ROWS, `${name}.json`), "utf8")) as SessionSummary, NOW);
}

/** The row inside a router, which its title link needs. */
function renderRow(row: Task) {
  const root = createRootRoute();
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <TooltipProvider>
        <ul>
          <TaskRow task={row} onArchive={vi.fn()} />
        </ul>
      </TooltipProvider>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(cleanup);

describe("TaskRow", () => {
  it("renders the status once per width from the same state, so the two copies cannot drift", async () => {
    const { container, findAllByText } = renderRow(task("working-queued"));
    expect(await findAllByText("Working, 2 queued")).toHaveLength(2);
    const wide = container.querySelector('[data-col="status"] > span');
    const narrow = container.querySelector('[data-col="title"] .md\\:hidden > span');
    expect(wide?.textContent).toBe("Working, 2 queued");
    expect(narrow?.textContent).toBe(wide?.textContent);
    expect(wide?.getAttribute("title")).toBe(narrow?.getAttribute("title"));
    // One copy is shown at each width: the column above md, the meta line below it.
    expect(wide?.parentElement?.className).toContain("hidden");
    expect(wide?.parentElement?.className).toContain("md:block");
    expect(narrow?.parentElement?.className).toContain("md:hidden");
  });
});
