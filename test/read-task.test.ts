import { describe, expect, it } from "vitest";
import { readTask } from "../opencomputer/agents/worker/read-task";

const payload = {
  taskId: "01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
  repo: "acme/service",
  ref: "main",
  actor: { id: 7, login: "jdoe" },
};

describe("readTask", () => {
  it("reads the structured payload when the turn carries one", () => {
    const read = readTask({ source: "user", text: "Rename billing to invoicing.", payload });
    expect(read).toEqual({
      task: { taskId: payload.taskId, repo: "acme/service", ref: "main", actor: { login: "jdoe" } },
      text: "Rename billing to invoicing.",
    });
  });

  it("parses the preamble line the app folds into the text under the stub", () => {
    const text = `[workbench] task=${payload.taskId} repo=acme/service ref=v2.1.0 actor=jdoe\nRename billing to invoicing.\nRun the tests.`;
    expect(readTask({ source: "user", text })).toEqual({
      task: { taskId: payload.taskId, repo: "acme/service", ref: "v2.1.0", actor: { login: "jdoe" } },
      text: "Rename billing to invoicing.\nRun the tests.",
    });
  });

  it("prefers the payload over a preamble and yields nothing for plain text", () => {
    const text = "[workbench] task=x repo=y/z ref=main actor=someone\nHello";
    expect(readTask({ source: "user", text, payload })?.task.repo).toBe("acme/service");
    expect(readTask({ source: "user", text: "Just a follow-up." })).toBeUndefined();
    expect(readTask({ source: "user" })).toBeUndefined();
    expect(readTask({ source: "user", text: "[workbench] task=only", payload: { taskId: 1 } })).toBeUndefined();
  });
});
