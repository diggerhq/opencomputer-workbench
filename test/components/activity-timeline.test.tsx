// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityTimeline } from "../../src/app/components/ActivityTimeline";
import { failureCopy } from "../../src/app/vocabulary";
import { reduce } from "./helpers";

afterEach(cleanup);

function callIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li[data-call-id]")).map((li) => li.getAttribute("data-call-id") ?? "");
}

describe("ActivityTimeline", () => {
  it("renders every call keyed by its id, collapsed, and expands to the output with the expander", () => {
    const { container } = render(<ActivityTimeline turns={reduce("completed").turns} isReplaying={false} />);
    expect(callIds(container)).toEqual([
      "toolu_01clone",
      "toolu_02ci",
      "toolu_03lint",
      "toolu_04test",
      "toolu_05push",
      "toolu_06report",
    ]);
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.getByText("38 s · 142 lines")).toBeTruthy();
    const ci = container.querySelector('li[data-call-id="toolu_02ci"]') as HTMLElement;
    fireEvent.click(within(ci).getByRole("button", { name: "Show output" }));
    const output = ci.querySelector("pre") as HTMLElement;
    expect(output.textContent).toContain("package-0");
    expect(output.textContent).toContain("…and 102 more lines");
    fireEvent.click(within(ci).getByRole("button", { name: "Show all" }));
    expect(ci.querySelector("pre")?.textContent).toContain("added 612 packages");
    expect(ci.querySelector("pre")?.textContent).not.toContain("more lines");
    fireEvent.click(within(ci).getByRole("button", { name: "Hide output" }));
    expect(ci.querySelector("pre")).toBeNull();
  });

  it("shows a non-zero exit in the failed tone and the report call as its fields", () => {
    const { container } = render(<ActivityTimeline turns={reduce("completed").turns} isReplaying={false} />);
    expect(screen.getByText("exit 1 · 1.1 s").parentElement?.className).toContain("text-status-failed");
    const report = container.querySelector('li[data-call-id="toolu_06report"]') as HTMLElement;
    fireEvent.click(within(report).getByRole("button", { name: "Show output" }));
    expect(within(report).getByText("#482 draft").closest("a")?.getAttribute("href")).toBe(
      "https://github.com/acme/service/pull/482",
    );
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual([
      expect.stringContaining("Turn 1"),
      expect.stringContaining("Turn 2"),
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
