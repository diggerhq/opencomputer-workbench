import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/lib/api";
import {
  AUTOMATIC_RETRIES,
  begin,
  compose,
  fail,
  IDLE,
  isUncertain,
  retry,
  shouldRetry,
  succeed,
} from "../../src/lib/submission";
import { ULID_PATTERN, ulid } from "../../src/lib/ulid";

const receipt = { turnId: "t1", status: "queued" as const, duplicate: false };

describe("the submission envelope", () => {
  it("mints one task id per logical submission and keeps it across retries", () => {
    const envelope = compose({ repo: "acme/service", ref: " main ", text: " Do it \n" });
    expect(envelope.taskId).toMatch(ULID_PATTERN);
    expect(envelope).toEqual({ taskId: envelope.taskId, repo: "acme/service", ref: "main", text: "Do it" });
    const state = begin(envelope);
    const failed = fail(state, new Error("socket hang up"));
    expect(failed).toMatchObject({ status: "failed", attempt: 1, problem: { code: "network_error", retryable: true } });
    const again = retry(failed);
    expect(again).toMatchObject({ status: "submitting", attempt: 2, envelope });
    expect(compose({ repo: "a/b", ref: "main", text: "x" }).taskId).not.toBe(envelope.taskId);
  });

  it("carries nothing about which deployment runs the task", () => {
    const envelope = compose({ repo: "acme/service", ref: "main", text: "Do it" });
    expect(Object.keys(envelope).sort()).toEqual(["ref", "repo", "taskId", "text"]);
  });

  it("is uncertain while in flight or after a retryable failure, so the next action is the same envelope", () => {
    const envelope = compose({ repo: "acme/service", ref: "main", text: "Do it" });
    const state = begin(envelope);
    expect(isUncertain(IDLE)).toBe(false);
    expect(isUncertain(state)).toBe(true);
    const lost = fail(state, new Error("socket hang up"));
    expect(isUncertain(lost)).toBe(true);
    expect(retry(lost)).toMatchObject({ status: "submitting", attempt: 2, envelope });
    expect(isUncertain(fail(state, new ApiError(409, "idempotency_conflict", "Different inputs.")))).toBe(false);
    expect(isUncertain(succeed(state, { id: "ses_new", receipt }))).toBe(false);
  });

  it("is held until a receipt arrives, a duplicate one included", () => {
    const state = begin(compose({ repo: "acme/service", ref: "main", text: "Do it" }));
    const done = succeed(state, { id: "ses_new", receipt: { ...receipt, duplicate: true } });
    expect(done).toMatchObject({ status: "done", id: "ses_new", receipt: { duplicate: true } });
    expect(succeed(IDLE, { id: "ses_new", receipt })).toBe(IDLE);
    expect(fail(IDLE, new Error("x"))).toBe(IDLE);
    expect(retry(IDLE)).toBe(IDLE);
  });

  it("retries lost replies and outages by itself, a bounded number of times", () => {
    let state = begin(compose({ repo: "acme/service", ref: "main", text: "Do it" }));
    for (let attempt = 1; attempt <= AUTOMATIC_RETRIES + 1; attempt += 1) {
      state = fail(state, new ApiError(503, "upstream_error", "OpenComputer answered 503"));
      expect(shouldRetry(state)).toBe(attempt <= AUTOMATIC_RETRIES);
      state = retry(state);
    }
  });

  it("keeps the draft and shows a conflict or a refusal without retrying", () => {
    const state = begin(compose({ repo: "acme/service", ref: "main", text: "Do it" }));
    const conflict = fail(state, new ApiError(409, "idempotency_conflict", "Different inputs."));
    expect(conflict).toMatchObject({ status: "failed", problem: { code: "idempotency_conflict", retryable: false } });
    expect(shouldRetry(conflict)).toBe(false);
    const refused = fail(state, new ApiError(402, "insufficient_credits", "Out of credits."));
    expect(refused).toMatchObject({ problem: { code: "insufficient_credits", retryable: false } });
  });
});

describe("ulid", () => {
  it("encodes the time in the first ten characters and is monotonic across milliseconds", () => {
    const a = ulid(1_000_000, new Uint8Array(10));
    const b = ulid(1_000_001, new Uint8Array(10));
    expect(a).toMatch(ULID_PATTERN);
    expect(a.slice(0, 10)).not.toBe(b.slice(0, 10));
    expect(a < b).toBe(true);
    expect(a.slice(10)).toBe("0000000000000000");
    expect(ulid(1_000_000, new Uint8Array(10).fill(255)).slice(10)).toBe("ZZZZZZZZZZZZZZZZ");
  });
});
