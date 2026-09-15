// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultCard } from "../../src/app/components/ResultCard";
import { latestResult } from "../../src/app/reducer";
import { reduce } from "./helpers";

afterEach(cleanup);

describe("ResultCard", () => {
  it("renders the published stage with the PR, the checks and the compare link", () => {
    const result = latestResult(reduce("completed"));
    if (!result) throw new Error("no result");
    render(<ResultCard result={result} repo="acme/service" baseRef="main" />);
    expect(screen.getByText("published").className).toContain("text-status-ready-for-review");
    expect(screen.getByText("reported by turn 1")).toBeTruthy();
    expect(screen.getByText("#482 draft").closest("a")?.getAttribute("href")).toBe(
      "https://github.com/acme/service/pull/482",
    );
    expect(screen.getByText("(reported)")).toBeTruthy();
    const compare = screen.getByText(/^Compare/).closest("a");
    expect(compare?.getAttribute("href")).toBe(
      `https://github.com/acme/service/compare/${result.report.baseSha}...${result.report.commit}`,
    );
    expect(screen.getByText("a1b2c3d")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
  });

  it("renders a base-only report as one row and no compare link", () => {
    const result = latestResult(reduce("ended"));
    if (!result) throw new Error("no result");
    const { container } = render(<ResultCard result={result} repo="acme/service" />);
    expect(container.querySelector("p.text-status-ready-for-review")?.textContent).toBe("base");
    expect(Array.from(container.querySelectorAll("dt")).map((dt) => dt.textContent)).toEqual(["base"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("says which turn an older result came from", () => {
    const result = latestResult(reduce("completed"));
    if (!result) throw new Error("no result");
    render(<ResultCard result={{ ...result, fromLastTurn: false, turnNumber: 1 }} />);
    expect(screen.getByText("Finished, no new changes reported · result from turn 1")).toBeTruthy();
  });

  it("has nothing to render for a session without a result", () => {
    expect(latestResult(reduce("created-only"))).toBeUndefined();
    expect(latestResult(reduce("turn-failed-runtime-lost"))).toBeUndefined();
  });
});
