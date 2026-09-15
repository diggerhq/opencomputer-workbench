// The composer: pick a repository, name a base revision, describe the task.
// It mints the task id, holds the envelope until the first turn's admission
// receipt arrives, retries a lost reply with the same envelope, and keeps
// the draft with the problem shown on a conflict or a refusal. Disabled
// until the workspace bootstrap has answered.
import { useQuery } from "@tanstack/react-query";
import { FolderGit2, GitCommitHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTask, listRepos, type Task, type Workspace } from "@/lib/api";
import {
  begin,
  compose,
  fail,
  IDLE,
  type Problem,
  retry,
  type Submission,
  shouldRetry,
  succeed,
} from "@/lib/submission";
import { FAILURE_COPY, failureCopy } from "@/vocabulary";

const CONFLICT_COPY = "A task with this id already exists with a different request. Keep editing or start over.";

function problemCopy(problem: Problem): string {
  if (problem.code === "idempotency_conflict") return CONFLICT_COPY;
  if (problem.code in FAILURE_COPY) return failureCopy(problem.code);
  return problem.message;
}

export function Composer({ workspace, onCreated }: { workspace?: Workspace; onCreated: (task: Task) => void }) {
  const repos = useQuery({ queryKey: ["repos"], queryFn: listRepos, enabled: Boolean(workspace) });
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const [submission, setSubmission] = useState<Submission>(IDLE);

  const repositories = repos.data?.repositories ?? [];
  const selected = repositories.find((entry) => entry.fullName === repo);
  const ready = Boolean(workspace) && repos.isSuccess;
  const submitting = submission.status === "submitting";
  const canSubmit = ready && !submitting && repo !== "" && text.trim() !== "";
  const none = repos.isSuccess && repositories.length === 0;

  async function send(state: Submission) {
    if (state.status !== "submitting") return;
    setSubmission(state);
    let next: Submission;
    try {
      next = succeed(state, await createTask(state.envelope));
    } catch (cause) {
      next = fail(state, cause);
    }
    if (next.status === "done") {
      setText("");
      setSubmission(IDLE);
      onCreated(next.task);
      return;
    }
    setSubmission(next);
    if (shouldRetry(next)) {
      const attempt = next.status === "failed" ? next.attempt : 1;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      await send(retry(next));
    }
  }

  function submit() {
    if (!workspace || !canSubmit) return;
    void send(begin(compose({ repo, ref: ref || selected?.defaultBranch || "", text }, workspace.deploymentId)));
  }

  const problem = submission.status === "failed" && !shouldRetry(submission) ? submission : undefined;

  return (
    <Card data-slot="composer" role="region" aria-label="New task">
      <CardContent className="grid gap-2">
        <div className="grid gap-2 md:grid-cols-3">
          <Select
            value={repo}
            onValueChange={(value) => {
              setRepo(value);
              const chosen = repositories.find((entry) => entry.fullName === value);
              if (chosen && (ref === "" || ref === selected?.defaultBranch)) setRef(chosen.defaultBranch);
            }}
            disabled={!ready || submitting || none}
          >
            <SelectTrigger className="w-full font-mono md:col-span-2" aria-label="Repository">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <FolderGit2 aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <SelectValue placeholder={none ? "No repositories are connected" : "Repository"} />
              </span>
            </SelectTrigger>
            <SelectContent>
              {repositories.map((entry) => (
                <SelectItem key={entry.fullName} value={entry.fullName} className="font-mono">
                  {entry.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <GitCommitHorizontal
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Base revision"
              className="pl-8 font-mono"
              placeholder={selected?.defaultBranch ?? "main"}
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              disabled={!ready}
              readOnly={submitting}
            />
          </div>
        </div>
        <Textarea
          aria-label="Request"
          placeholder="Describe the task. The first line becomes the title."
          className="h-24 resize-none"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
          }}
          disabled={!ready}
          readOnly={submitting}
        />
        {problem ? (
          <p role="alert" className="rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
            {problemCopy(problem.problem)}
            {problem.problem.retryable ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0 text-status-failed underline"
                onClick={() => void send(retry(problem))}
              >
                Retry
              </Button>
            ) : problem.problem.code === "idempotency_conflict" ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0 text-status-failed underline"
                onClick={() => setSubmission(IDLE)}
              >
                Start over
              </Button>
            ) : null}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between gap-4">
        <p className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          The agent clones the repository, works on a branch and opens a draft pull request.
          <KbdGroup aria-label="Command Enter starts the task">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
        </p>
        <Button type="button" className="w-full md:w-auto" disabled={!canSubmit} onClick={submit}>
          {submitting ? "Starting…" : "Start task"}
        </Button>
      </CardFooter>
    </Card>
  );
}
