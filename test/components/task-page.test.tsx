// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "../../src/app/routeTree.gen";
import type { SessionSummary } from "../../src/server/oc";
import { type Task, toTask } from "../../src/server/task";
import { load } from "./helpers";

const ROWS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "rows");
const NOW = Date.parse("2026-09-15T20:46:00.000Z");

function task(name: string): Task {
  return toTask(JSON.parse(readFileSync(join(ROWS, `${name}.json`), "utf8")) as SessionSummary, NOW);
}

const WORKSPACE = {
  identity: { id: 1, login: "jdoe", avatarUrl: "" },
  deploymentId: "dep_dev",
  environment: "development",
  membership: { kind: "team", display: "acme/platform" },
};

interface Served {
  readonly task?: Task;
  readonly log: string;
}

/** A fetch that serves the app's routes for one task from a row fixture and a log fixture. */
function serve(served: Served) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let current = served.task;
  const events = load(served.log);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fake = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://workbench.test");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path: url.pathname, ...(body !== undefined ? { body } : {}) });
    if (url.pathname === "/api/workspace") return json(WORKSPACE);
    const taskMatch = /^\/api\/tasks\/([^/]+)(\/end)?$/.exec(url.pathname);
    if (taskMatch) {
      if (!current) return json({ error: { code: "not_found", message: "No such session." } }, 404);
      if (method === "PATCH") {
        const patch = body as { archived?: boolean };
        current = { ...current, archived: patch.archived ?? current.archived };
        return json({ task: current });
      }
      if (taskMatch[2]) {
        current = { ...current, execution: "ended" };
        return json({ task: current });
      }
      return json({ task: current });
    }
    const agent = /^\/api\/agent\/sessions\/([^/]+)\/(events|turns|interrupt)$/.exec(url.pathname);
    if (agent) {
      if (agent[2] === "events") {
        const after = Number(url.searchParams.get("after") ?? "0");
        return json({ events: events.filter((event) => event.seq > after).slice(0, 500) });
      }
      if (agent[2] === "turns") return json({ turnId: "turn_new", status: "queued", duplicate: false }, 202);
      return json({});
    }
    return json({ error: { code: "not_found", message: "No such route." } }, 404);
  });
  return { fake, calls, current: () => current };
}

async function open(id: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [`/tasks/${id}`] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return router;
}

const original = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  globalThis.fetch = original;
  vi.restoreAllMocks();
});

describe("the task page", () => {
  it("renders the task's facets, the badge, and the log's result with the compare link from the task's repo", async () => {
    const row = task("ready-published");
    const served = serve({ task: row, log: "completed" });
    globalThis.fetch = served.fake as typeof fetch;
    await open(row.id);
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(row.title));
    const header = screen.getByRole("heading", { level: 2 }).closest("header") as HTMLElement;
    expect(header.textContent).toContain("acme/service");
    expect(header.textContent).toContain("v2.1.0");
    expect(header.textContent).toContain("mo");
    expect(screen.getByText("Ready for review")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("reported by turn 1")).toBeTruthy(), { timeout: 3000 });
    const compare = screen.getByText(/^Compare/).closest("a");
    // The log's shas, not the row's: the log wins once it has replayed.
    expect(compare?.getAttribute("href")).toBe(
      "https://github.com/acme/service/compare/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678...d4e5f6a7b8c90112233445566778899aabbccdde",
    );
    const request = screen.getByRole("region", { name: "Request" });
    expect(request.textContent).toContain("Rename billing to invoicing");
    expect(served.calls.some((call) => call.path === `/api/agent/sessions/${row.id}/events`)).toBe(true);
  });

  it("shows the row's result until the log has replayed", async () => {
    const row = task("ready-published");
    const served = serve({ task: row, log: "created-only" });
    globalThis.fetch = served.fake as typeof fetch;
    await open(row.id);
    await waitFor(() => expect(screen.getByText("published")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText(`reported by turn ${row.result?.turnId.slice(0, 8) ?? ""}`)).toBeTruthy();
    expect(
      screen
        .getByText(/^Compare/)
        .closest("a")
        ?.getAttribute("href"),
    ).toBe(`https://github.com/acme/service/compare/${row.result?.baseSha ?? ""}...${row.result?.commit ?? ""}`);
  });

  it("archives through the task route and refetches the task and the list", async () => {
    const row = task("idle");
    const served = serve({ task: row, log: "completed" });
    globalThis.fetch = served.fake as typeof fetch;
    await open(row.id);
    const archive = await screen.findByRole("button", { name: "Archive" });
    await waitFor(() => expect(archive.hasAttribute("disabled")).toBe(false));
    const before = served.calls.filter((call) => call.method === "GET" && call.path === `/api/tasks/${row.id}`).length;
    await act(async () => {
      fireEvent.click(archive);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Unarchive" })).toBeTruthy(), { timeout: 3000 });
    expect(served.calls).toContainEqual({ method: "PATCH", path: `/api/tasks/${row.id}`, body: { archived: true } });
    await waitFor(() =>
      expect(served.calls.filter((call) => call.method === "GET" && call.path === `/api/tasks/${row.id}`).length).toBe(
        before + 1,
      ),
    );
    expect(screen.getByText("Archived")).toBeTruthy();
  });

  it("ends the task after the confirmation and disables the composer", async () => {
    const row = task("idle");
    const served = serve({ task: row, log: "completed" });
    globalThis.fetch = served.fake as typeof fetch;
    await open(row.id);
    const end = await screen.findByRole("button", { name: "End" });
    await waitFor(() => expect(end.hasAttribute("disabled")).toBe(false));
    fireEvent.click(end);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("End this task?");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "End" }).at(-1) as HTMLElement);
    });
    await waitFor(() => expect(screen.getByText("This task has ended.")).toBeTruthy(), { timeout: 3000 });
    expect(served.calls).toContainEqual({ method: "POST", path: `/api/tasks/${row.id}/end` });
    expect((screen.getByRole("textbox", { name: "Follow up" }) as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText("Ended")).toBeTruthy();
  });

  it("renders the not-found state with a way back when the task route answers 404", async () => {
    const served = serve({ log: "created-only" });
    globalThis.fetch = served.fake as typeof fetch;
    await open("00000000-0000-4000-8000-000000000000");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No such task."), { timeout: 3000 });
    expect(screen.getByRole("link", { name: "← Tasks" }).getAttribute("href")).toBe("/");
  });
});
