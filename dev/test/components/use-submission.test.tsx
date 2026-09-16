// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSubmission } from "../../../src/components/use-submission";
import { ApiError } from "../../../src/lib/api";
import { compose, type Envelope, type Receipt } from "../../../src/lib/submission";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Answer = { id: string; receipt: Receipt };
const receipt: Receipt = { turnId: "t1", status: "queued", duplicate: false };
const envelope = compose({ repo: "acme/service", ref: "main", text: "Do it" });

const lost = () => Promise.reject(new ApiError(503, "upstream_error", "OpenComputer answered 503"));
const admitted = () => Promise.resolve({ id: "ses_new", receipt });

/** Answers the requests in order; one more request than answers is a failure. */
function sender(answers: Array<() => Promise<Answer>>) {
  return vi.fn((_envelope: Envelope): Promise<Answer> => {
    const next = answers.shift();
    if (!next) return Promise.reject(new Error("a request nobody expected"));
    return next();
  });
}

describe("useSubmission", () => {
  it("keeps one chain: a manual retry during the backoff supersedes the timer, so success navigates once", async () => {
    vi.useFakeTimers();
    const onCreated = vi.fn();
    const send = sender([lost, admitted, admitted]);
    const { result } = renderHook(() => useSubmission({ send, onCreated }));

    await act(async () => result.current.start(envelope));
    expect(result.current.submission).toMatchObject({ status: "failed", attempt: 1, problem: { retryable: true } });
    expect(send).toHaveBeenCalledTimes(1);

    // The automatic retry is waiting; the person clicks Retry first.
    await act(async () => result.current.retryNow());
    expect(send).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith("ses_new");
    expect(result.current.submission).toEqual({ status: "idle" });

    // The superseded timer never fires: two requests and one navigation, not three and two.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(send.mock.calls.map(([sent]) => sent)).toEqual([envelope, envelope]);
  });

  it("retries a lost reply by itself with the same envelope, backing off per attempt", async () => {
    vi.useFakeTimers();
    const onCreated = vi.fn();
    const send = sender([lost, lost, admitted]);
    const { result } = renderHook(() => useSubmission({ send, onCreated }));
    await act(async () => result.current.start(envelope));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.current.submission).toMatchObject({ status: "failed", attempt: 2 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.map(([sent]) => sent.taskId)).toEqual([envelope.taskId, envelope.taskId, envelope.taskId]);
    expect(onCreated).toHaveBeenCalledWith("ses_new");
  });

  it("drops the chain on unmount: no timer fires and a late answer navigates nowhere", async () => {
    vi.useFakeTimers();
    const onCreated = vi.fn();
    let answer: (value: Answer) => void = () => undefined;
    const late = () => new Promise<Answer>((resolve) => (answer = resolve));
    const send = sender([lost, late]);
    const { result, unmount } = renderHook(() => useSubmission({ send, onCreated }));
    await act(async () => result.current.start(envelope));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(send).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => {
      answer({ id: "ses_new", receipt });
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps a conflict without a timer, and reset abandons it", async () => {
    vi.useFakeTimers();
    const send = sender([() => Promise.reject(new ApiError(409, "idempotency_conflict", "Different inputs."))]);
    const { result } = renderHook(() => useSubmission({ send, onCreated: vi.fn() }));
    await act(async () => result.current.start(envelope));
    expect(result.current.submission).toMatchObject({ status: "failed", problem: { retryable: false } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => result.current.retryNow());
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => result.current.reset());
    expect(result.current.submission).toEqual({ status: "idle" });
  });
});
