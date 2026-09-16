import { describe, expect, it } from "vitest";
import { readTask } from "../../opencomputer/agents/worker/read-task";

const payload = {
  taskId: "01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
  repo: "acme/service",
  ref: "main",
  actor: { id: 7, login: "jdoe" },
};

describe("readTask", () => {
  it("reads the structured payload the first turn carries", () => {
    const read = readTask({ source: "user", text: "Rename billing to invoicing.", payload });
    expect(read).toEqual({
      task: { taskId: payload.taskId, repo: "acme/service", ref: "main", actor: { login: "jdoe" } },
      text: "Rename billing to invoicing.",
    });
  });

  it("yields nothing for a follow-up, which carries no payload, or a payload of another shape", () => {
    expect(readTask({ source: "user", text: "Just a follow-up." })).toBeUndefined();
    expect(readTask({ source: "user" })).toBeUndefined();
    expect(readTask({ source: "user", text: "x", payload: { taskId: 1 } })).toBeUndefined();
    expect(readTask({ source: "user", text: "x", payload: [payload] })).toBeUndefined();
  });
});
