import { describe, expect, it } from "vitest";
import { PREAMBLE, taskRequest } from "../src/server/request";

const submission = {
  taskId: "01J9Y0C6R4V3M2K7Q8N5P1H9ZT",
  repo: "acme/service",
  ref: "main",
  text: "Add a health endpoint",
  actor: { id: 1, login: "octocat" },
};

describe("taskRequest", () => {
  it("sends the context as the turn's payload", () => {
    expect(taskRequest(submission, false)).toEqual({
      input: "Add a health endpoint",
      payload: { taskId: submission.taskId, repo: "acme/service", ref: "main", actor: { id: 1, login: "octocat" } },
    });
  });

  it("folds the context into one preamble line only under the development stub", () => {
    const stubbed = taskRequest(submission, true);
    expect(stubbed.payload).toBeUndefined();
    expect(stubbed.input.split("\n")[0]).toBe(
      `${PREAMBLE} task=${submission.taskId} repo=acme/service ref=main actor=octocat`,
    );
    expect(stubbed.input.split("\n").slice(1).join("\n")).toBe("Add a health endpoint");
  });
});
