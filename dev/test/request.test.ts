import { describe, expect, it } from "vitest";
import { taskRequest } from "../../src/server/request";

const submission = {
  taskId: "01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
  repo: "acme/service",
  ref: "main",
  text: "Add a health endpoint",
  actor: { id: 1, login: "octocat" },
};

describe("taskRequest", () => {
  it("sends the text as the message and the context as the turn's payload", () => {
    expect(taskRequest(submission)).toEqual({
      input: "Add a health endpoint",
      payload: { taskId: submission.taskId, repo: "acme/service", ref: "main", actor: { id: 1, login: "octocat" } },
    });
  });
});
