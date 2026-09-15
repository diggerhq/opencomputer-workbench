// The worker: one agent, one connection, one tool, one model. Everything
// about coding, git and GitHub is the harness and the managed connection;
// this file only says what to do and how to report it.
import { defineConnection, githubApp, useConnection, useInput, useModel, useTool } from "@opencomputer/agent";
import { readTask } from "./read-task";
import { report } from "./tools/report";

const github = defineConnection({
  id: "github",
  provider: githubApp({ permissions: { contents: "write", pull_requests: "write" } }),
});

export default function Worker() {
  const input = useInput();
  useModel("anthropic/claude-sonnet-4.6");
  useConnection(github);
  useTool(report);
  const read = readTask(input);
  const task = read?.task;
  return [
    task &&
      `Repository ${task.repo} at ${task.ref}. Task ${task.taskId}, requested by ${task.actor.login}. Work in a directory named after the repository under the current working directory.`,
    "Clone the repository at the requested ref and call report with the repository and the resolved base commit before changing anything. Work on branch task/<task id>.",
    "Follow the repository's agent instructions file when present (AGENTS.md or similar). Run the checks the repository defines and report each one with its command and outcome.",
    "Commit with a Co-authored-by trailer naming the requester. Push the branch, open a draft pull request whose body links the task, then call report with the branch, the tested commit, the pull request and the checks. Report again whenever one of these changes; each call carries everything known so far.",
    "On a follow-up, continue on the same branch and update the same pull request. When a decision is needed, ask in your final message and stop.",
    "Never print GH_TOKEN or GITHUB_TOKEN, never write them into files, and never add them to a Git remote URL.",
  ]
    .filter(Boolean)
    .join("\n");
}
