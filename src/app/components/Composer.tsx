// The composer: pick a repository, name a base revision, describe the task.
// It mints the task id, holds the envelope until the first turn's admission
// receipt arrives, retries a lost reply with the same envelope, and keeps
// the draft with the problem shown on a conflict or a refusal. Disabled
// until the workspace bootstrap has answered.
import { useQuery } from "@tanstack/react-query";
import { FolderGit2, GitCommitHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

const MAX_ROWS = 8;

function grow(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  const line = Number.parseFloat(getComputedStyle(element).lineHeight) || 22;
  element.style.height = `${String(Math.min(element.scrollHeight, MAX_ROWS * line + 24))}px`;
}

export function Composer({ workspace, onCreated }: { workspace?: Workspace; onCreated: (task: Task) => void }) {
  const repos = useQuery({ queryKey: ["repos"], queryFn: listRepos, enabled: Boolean(workspace) });
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const [submission, setSubmission] = useState<Submission>(IDLE);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const repositories = repos.data?.repositories ?? [];
  const selected = repositories.find((entry) => entry.fullName === repo);
  const ready = Boolean(workspace) && repos.isSuccess;
  const submitting = submission.status === "submitting";
  const canSubmit = ready && !submitting && repo !== "" && text.trim() !== "";
  const none = repos.isSuccess && repositories.length === 0;

  // The textarea grows from three lines to eight with its content.
  useEffect(() => {
    if (textarea.current) grow(textarea.current);
  }, []);

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
    <section aria-label="New task" className="rounded-xl border border-border bg-card shadow-card">
      <div className="grid gap-2 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:p-4 md:pb-3">
        <Select
          value={repo}
          onValueChange={(value) => {
            setRepo(value);
            const chosen = repositories.find((entry) => entry.fullName === value);
            if (chosen && (ref === "" || ref === selected?.defaultBranch)) setRef(chosen.defaultBranch);
          }}
          disabled={!ready || submitting || none}
        >
          <SelectTrigger className="h-control w-full font-mono text-sm" aria-label="Repository">
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <FolderGit2 aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <SelectValue placeholder={none ? "No repositories are connected" : "Repository"} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {repositories.map((entry) => (
              <SelectItem key={entry.fullName} value={entry.fullName} className="font-mono text-sm">
                {entry.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <GitCommitHorizontal
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Base revision"
            className="h-control pl-9 font-mono text-sm"
            placeholder={selected?.defaultBranch ?? "main"}
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            disabled={!ready}
            readOnly={submitting}
          />
        </div>
      </div>
      <div className="px-3 md:px-4">
        <Textarea
          ref={textarea}
          aria-label="Request"
          rows={3}
          placeholder="Describe the task. The first line becomes the title."
          className="min-h-20 resize-none text-base"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            grow(event.target);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
          }}
          disabled={!ready}
          readOnly={submitting}
        />
      </div>
      {problem ? (
        <p
          role="alert"
          className="mx-3 mt-3 rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed md:mx-4"
        >
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
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-4 md:pt-3">
        <p className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          The agent clones the repository, works on a branch and opens a draft pull request.
          <KbdGroup aria-label="Command Enter starts the task">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
        </p>
        <Button type="button" size="lg" className="w-full md:w-auto md:px-4" disabled={!canSubmit} onClick={submit}>
          {submitting ? "Starting…" : "Start task"}
        </Button>
      </div>
    </section>
  );
}
