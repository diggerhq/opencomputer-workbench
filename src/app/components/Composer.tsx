// The composer: pick a repository, name a base revision, describe the task.
// It mints the task id, holds the envelope until the first turn's admission
// receipt arrives, retries a lost reply with the same envelope, and keeps
// the draft with the problem shown on a conflict or a refusal. Disabled
// until the workspace bootstrap has answered.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const textarea = useRef<HTMLTextAreaElement>(null);

  const repositories = repos.data?.repositories ?? [];
  const selected = repositories.find((entry) => entry.fullName === repo);
  const ready = Boolean(workspace) && repos.isSuccess;
  const submitting = submission.status === "submitting";
  const canSubmit = ready && !submitting && repo !== "" && text.trim() !== "";

  // The textarea grows from three lines to eight with its content.
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${String(Math.min(element.scrollHeight, 8 * 24))}px`;
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

  return (
    <section aria-label="New task" className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Select
          value={repo}
          onValueChange={(value) => {
            setRepo(value);
            const chosen = repositories.find((entry) => entry.fullName === value);
            if (chosen && (ref === "" || ref === selected?.defaultBranch)) setRef(chosen.defaultBranch);
          }}
          disabled={!ready || submitting || repositories.length === 0}
        >
          <SelectTrigger className="h-control w-full font-mono text-sm" aria-label="Repository">
            <SelectValue
              placeholder={
                repos.isSuccess && repositories.length === 0 ? "No repositories are connected" : "Repository"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {repositories.map((entry) => (
              <SelectItem key={entry.fullName} value={entry.fullName} className="font-mono text-sm">
                {entry.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Base revision"
          className="h-control font-mono text-sm"
          placeholder={selected?.defaultBranch ?? "main"}
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          disabled={!ready}
          readOnly={submitting}
        />
      </div>
      <Textarea
        ref={textarea}
        aria-label="Request"
        rows={3}
        placeholder="Describe the task. The first line becomes the title."
        className="min-h-20 resize-none text-base"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          event.target.style.height = "auto";
          event.target.style.height = `${String(Math.min(event.target.scrollHeight, 8 * 24))}px`;
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
        }}
        disabled={!ready}
        readOnly={submitting}
      />
      {submission.status === "failed" && !shouldRetry(submission) ? (
        <p role="alert" className="text-sm text-destructive">
          {problemCopy(submission.problem)}
          {submission.problem.retryable ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="ml-2"
              onClick={() => void send(retry(submission))}
            >
              Retry
            </Button>
          ) : submission.problem.code === "idempotency_conflict" ? (
            <Button type="button" variant="link" size="sm" className="ml-2" onClick={() => setSubmission(IDLE)}>
              Start over
            </Button>
          ) : null}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" className="h-control w-full md:w-auto" disabled={!canSubmit} onClick={submit}>
          {submitting ? "Starting…" : "Start task"}
        </Button>
      </div>
    </section>
  );
}
