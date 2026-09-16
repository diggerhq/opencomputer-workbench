// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultCard } from "../../../src/components/ResultCard";
import { latestResult } from "../../../src/lib/activity";
import { reduce } from "./helpers";

afterEach(cleanup);

describe("ResultCard", () => {
  it("renders the published stage with the PR, the checks and the compare link", () => {
    const result = latestResult(reduce("completed"));
    if (!result) throw new Error("no result");
    render(<ResultCard {...result} reportedBy="turn 1" repo="diggerhq/opencomputer-workbench" baseRef="main" />);
    expect(screen.getByText("published").className).toContain("text-status-ready-for-review");
    expect(screen.getByText("reported by turn 1")).toBeTruthy();
    expect(screen.getByText("#19 draft").closest("a")?.getAttribute("href")).toBe(
      "https://github.com/diggerhq/opencomputer-workbench/pull/19",
    );
    expect(screen.getByText("(reported)")).toBeTruthy();
    const compare = screen.getByText(/^Compare/).closest("a");
    expect(compare?.getAttribute("href")).toBe(
      `https://github.com/diggerhq/opencomputer-workbench/compare/${result.report.baseSha}...${result.report.commit}`,
    );
    expect(screen.getByText("efbf829")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
  });

  it("renders a base-only report as one row and no compare link", () => {
    const result = latestResult(reduce("ended"));
    if (!result) throw new Error("no result");
    const { container } = render(<ResultCard {...result} reportedBy="turn 1" repo="acme/service" />);
    expect(container.querySelector("span.text-status-ready-for-review")?.textContent).toBe("base");
    expect(Array.from(container.querySelectorAll("dt")).map((dt) => dt.textContent)).toEqual(["base"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("says which turn an older result came from", () => {
    const result = latestResult(reduce("completed"));
    if (!result) throw new Error("no result");
    render(<ResultCard {...result} fromLastTurn={false} reportedBy="turn 1" />);
    expect(screen.getByText("Finished, no new changes reported · result from turn 1")).toBeTruthy();
  });

  it("has nothing to render for a session without a result", () => {
    expect(latestResult(reduce("created-only"))).toBeUndefined();
    expect(latestResult(reduce("turn-failed-runtime-lost"))).toBeUndefined();
  });
});
