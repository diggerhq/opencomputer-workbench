// @vitest-environment happy-dom
import type { AgentMessage } from "@opencomputer/react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "../../src/app/components/Conversation";
import { failureCopy } from "../../src/app/vocabulary";
import { reduce } from "./helpers";

afterEach(cleanup);

function messagesOf(name: string): AgentMessage[] {
  return reduce(name).turns.flatMap((turn) =>
    turn.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      turnId: turn.id,
      streaming: message.streaming,
    })),
  );
}

describe("Conversation", () => {
  it("keeps the draft when send rejects and clears it once the platform admits the input", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const send = vi.fn().mockRejectedValueOnce(new Error("Nothing was admitted.")).mockResolvedValueOnce({});
    render(
      <Conversation
        messages={messagesOf("completed")}
        turns={reduce("completed").turns}
        actorLogin="jdoe"
        ended={false}
        isReplaying={false}
        send={send}
      />,
    );
    const box = screen.getByRole("textbox", { name: "Follow up" }) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: "Send" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.change(box, { target: { value: "Also update the docs" } });
    expect(button.hasAttribute("disabled")).toBe(false);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(send).toHaveBeenCalledWith("Also update the docs", {
      idempotencyKey: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    });
    expect(box.value).toBe("Also update the docs");
    expect(error).toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(send).toHaveBeenCalledTimes(2);
    // The retry of the same draft carries the same key, so it is the same submission.
    expect(send.mock.calls[1]?.[1]).toEqual(send.mock.calls[0]?.[1]);
    expect(box.value).toBe("");
    error.mockRestore();
  });

  it("labels speakers, ends a streaming message with the caret and shows the turn markers", () => {
    const { container, unmount } = render(
      <Conversation
        messages={messagesOf("working")}
        turns={reduce("working").turns}
        actorLogin="jdoe"
        ended={false}
        isReplaying={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("jdoe")).toBeTruthy();
    expect(screen.getByText("agent")).toBeTruthy();
    expect(container.querySelector(".streaming-caret")).not.toBeNull();
    unmount();
    render(
      <Conversation
        messages={messagesOf("turn-failed-runtime-lost")}
        turns={reduce("turn-failed-runtime-lost").turns}
        actorLogin="jdoe"
        ended={false}
        isReplaying={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(failureCopy("runtime_lost"));
    cleanup();
    render(
      <Conversation
        messages={messagesOf("cancelled")}
        turns={reduce("cancelled").turns}
        actorLogin="jdoe"
        ended={false}
        isReplaying={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("Stopped")).toBeTruthy();
  });

  it("disables the composer and explains when the task has ended", () => {
    render(
      <Conversation
        messages={messagesOf("ended")}
        turns={reduce("ended").turns}
        actorLogin="jdoe"
        ended
        isReplaying={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("This task has ended.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Follow up" }) as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("says it is loading while replaying an empty log", () => {
    render(<Conversation messages={[]} turns={[]} actorLogin="jdoe" ended={false} isReplaying send={vi.fn()} />);
    expect(screen.getByText("Loading the conversation…")).toBeTruthy();
  });
});
