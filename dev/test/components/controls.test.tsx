// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Controls } from "../../../src/components/Controls";

afterEach(cleanup);

describe("Controls", () => {
  it("disables Stop when nothing runs and keeps every control in place", () => {
    render(<Controls isRunning={false} ended={false} archived={false} onStop={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Stop" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Archive" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "End" }).hasAttribute("disabled")).toBe(true);
  });

  it("stops the running turn once and reads Stopping until the log settles it", () => {
    const onStop = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <Controls
        isRunning
        activeTurnId="t1"
        ended={false}
        archived={false}
        onStop={onStop}
        onArchive={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop.hasAttribute("disabled")).toBe(false);
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Stopping…" }).hasAttribute("disabled")).toBe(true);
    rerender(
      <Controls isRunning={false} ended={false} archived={false} onStop={onStop} onArchive={vi.fn()} onEnd={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Stop" }).hasAttribute("disabled")).toBe(true);
    rerender(
      <Controls
        isRunning
        activeTurnId="t2"
        ended={false}
        archived={false}
        onStop={onStop}
        onArchive={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Stop" }).hasAttribute("disabled")).toBe(false);
  });

  it("confirms End in a dialog before calling back", () => {
    const onEnd = vi.fn();
    render(<Controls isRunning={false} ended={false} archived onStop={vi.fn()} onArchive={vi.fn()} onEnd={onEnd} />);
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("End this task?");
    expect(dialog.textContent).toContain("Queued work is cancelled and the conversation becomes read-only.");
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "End" }).at(-1) as HTMLElement);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
