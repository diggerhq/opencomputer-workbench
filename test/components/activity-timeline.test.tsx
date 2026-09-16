// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { commandOutcome } from "../../src/app/activity";
import { ActivityTimeline } from "../../src/app/components/ActivityTimeline";
import { failureCopy } from "../../src/app/vocabulary";
import { reduce } from "./helpers";

afterEach(cleanup);

function callIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li[data-call-id]")).map((li) => li.getAttribute("data-call-id") ?? "");
}

describe("ActivityTimeline", () => {
  it("renders every call keyed by its id, collapsed, and expands to the output with the expander", () => {
    const { turns } = reduce("completed");
    const { container } = render(<ActivityTimeline turns={turns} isReplaying={false} />);
    // Every call of the recording in log order, keyed by the runtime's call id.
    const recorded = turns.flatMap((turn) => turn.toolCalls.map((call) => call.callId));
    expect(recorded).toHaveLength(38);
    expect(callIds(container)).toEqual(recorded);
    expect(container.querySelector("pre")).toBeNull();
    // The install that finally brought the dev dependencies: 3 min 30 s, ten lines.
    expect(screen.getByText("3 min 30 s · 10 lines")).toBeTruthy();
    // The repository's check: 199 lines of output, collapsed to the preview.
    const checkId = "toolu_01LWthA6E1RHsN7QnrWHTMVb";
    const checkCall = turns[0]?.toolCalls.find((call) => call.callId === checkId);
    if (!checkCall) throw new Error("the recording has no check call");
    const hidden = commandOutcome(checkCall).lines - 40;
    expect(hidden).toBeGreaterThan(100);
    const check = container.querySelector(`li[data-call-id="${checkId}"]`) as HTMLElement;
    fireEvent.click(within(check).getByRole("button", { name: "Show output" }));
    const output = check.querySelector("pre") as HTMLElement;
    expect(output.textContent).toContain("> opencomputer-workbench@0.0.1 check");
    expect(output.textContent).toContain(`…and ${String(hidden)} more lines`);
    fireEvent.click(within(check).getByRole("button", { name: "Show all" }));
    expect(check.querySelector("pre")?.textContent).toContain("Test Files");
    expect(check.querySelector("pre")?.textContent).not.toContain("more lines");
    fireEvent.click(within(check).getByRole("button", { name: "Hide output" }));
    expect(check.querySelector("pre")).toBeNull();
  });

  it("shows a non-zero exit in the failed tone and the report call as its fields", () => {
    const { container } = render(<ActivityTimeline turns={reduce("completed").turns} isReplaying={false} />);
    expect(screen.getByText("exit 1 · 43 s").parentElement?.className).toContain("text-status-failed");
    const report = container.querySelector('li[data-call-id="toolu_017rPXUY1Ng9kbJCw6fvKYV5"]') as HTMLElement;
    fireEvent.click(within(report).getByRole("button", { name: "Show output" }));
    expect(within(report).getByText("#19 draft").closest("a")?.getAttribute("href")).toBe(
      "https://github.com/diggerhq/opencomputer-workbench/pull/19",
    );
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual([
      expect.stringContaining("Turn 1"),
    ]);
  });

  it("marks a running call with the pulsing dot and a timed-out one in the failed tone", () => {
    const { container, unmount } = render(<ActivityTimeline turns={reduce("working").turns} isReplaying={false} />);
    const running = container.querySelector('li[data-call-id="toolu_04test"]') as HTMLElement;
    expect(running.querySelector(".status-dot-pulse")).not.toBeNull();
    expect(within(running).getByText("running")).toBeTruthy();
    unmount();
    render(<ActivityTimeline turns={reduce("tool-timed-out").turns} isReplaying={false} />);
    expect(screen.getByText("timed out after 2 min").parentElement?.className).toContain("text-status-failed");
  });

  it("renders a failed turn's copy and code under its entries", () => {
    render(<ActivityTimeline turns={reduce("turn-failed-runtime-lost").turns} isReplaying={false} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain(failureCopy("runtime_lost"));
    expect(status.textContent).toContain("runtime_lost");
  });

  it("shows skeleton entries while replaying and the empty copy once the log is read", () => {
    const { unmount } = render(<ActivityTimeline turns={[]} isReplaying />);
    expect(screen.getByRole("status", { name: "Loading activity" })).toBeTruthy();
    unmount();
    render(<ActivityTimeline turns={[]} isReplaying={false} />);
    expect(screen.getByText("Nothing has run yet.")).toBeTruthy();
  });
});
