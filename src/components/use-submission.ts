// The composer's submission, driven by one chain at a time. A chain is the
// sequence of attempts of one envelope: the request in flight and the
// automatic retry waiting behind a lost reply. Starting another submission,
// retrying by hand, abandoning the draft or unmounting supersedes the chain:
// its timer is cleared and whatever its request still answers settles into
// nothing. So a manual Retry during the backoff never leaves a second timer
// behind, and a stale completion never navigates twice.
import { useCallback, useEffect, useRef, useState } from "react";
import { createTask } from "@/lib/api";
import {
  begin,
  type Envelope,
  fail,
  IDLE,
  type Receipt,
  retry,
  type Submission,
  shouldRetry,
  succeed,
} from "@/lib/submission";

export interface SubmissionController {
  readonly submission: Submission;
  /** A new envelope, a new chain. */
  readonly start: (envelope: Envelope) => void;
  /** The failed submission again, now; the automatic retry that was waiting is dropped. */
  readonly retryNow: () => void;
  /** Abandons the submission and its chain. */
  readonly reset: () => void;
}

interface Chain {
  /** Identifies the active chain; an attempt whose token is stale belongs to a superseded one. */
  token: number;
  /** The automatic retry waiting to fire, if any. */
  timer: ReturnType<typeof setTimeout> | undefined;
}

export function useSubmission({
  send = createTask,
  onCreated,
}: {
  send?: (envelope: Envelope) => Promise<{ id: string; receipt: Receipt }>;
  onCreated: (id: string) => void;
}): SubmissionController {
  const [submission, setSubmission] = useState<Submission>(IDLE);
  const chain = useRef<Chain>({ token: 0, timer: undefined });
  const callbacks = useRef({ send, onCreated });
  callbacks.current = { send, onCreated };

  const supersede = useCallback((): number => {
    const current = chain.current;
    if (current.timer !== undefined) clearTimeout(current.timer);
    current.timer = undefined;
    current.token += 1;
    return current.token;
  }, []);

  useEffect(() => () => void supersede(), [supersede]);

  const run = useCallback(
    async (state: Submission, token: number): Promise<void> => {
      if (state.status !== "submitting") return;
      setSubmission(state);
      let next: Submission;
      try {
        next = succeed(state, await callbacks.current.send(state.envelope));
      } catch (cause) {
        next = fail(state, cause);
      }
      // A newer chain took over, or the composer is gone: this outcome is nobody's.
      if (token !== chain.current.token) return;
      if (next.status === "done") {
        supersede();
        setSubmission(IDLE);
        callbacks.current.onCreated(next.id);
        return;
      }
      setSubmission(next);
      if (next.status === "failed" && shouldRetry(next)) {
        chain.current.timer = setTimeout(() => {
          chain.current.timer = undefined;
          void run(retry(next), token);
        }, 1000 * next.attempt);
      }
    },
    [supersede],
  );

  return {
    submission,
    start: (envelope) => void run(begin(envelope), supersede()),
    retryNow: () => {
      if (submission.status === "failed" && submission.problem.retryable) {
        void run(retry(submission), supersede());
      }
    },
    reset: () => {
      supersede();
      setSubmission(IDLE);
    },
  };
}
