import type { AgentMessage } from "@opencomputer/react";
import { Bot } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Turn } from "@/reducer";
import { failureCopy } from "@/vocabulary";
import { Markdown } from "./Markdown";

export interface ConversationProps {
  /** The hook's messages, in log order. */
  readonly messages: readonly AgentMessage[];
  /** The reduced turns, for the failure and stopped markers after a turn's messages. */
  readonly turns: readonly Turn[];
  readonly actorLogin: string;
  /** The actor's GitHub id, for the avatar beside their messages. */
  readonly actorId?: number;
  readonly ended: boolean;
  readonly isReplaying: boolean;
  /** A request or poll failure the hook reports; shown once, not as a turn failure. */
  readonly connectionError?: string;
  /** The hook's `send`: resolves on admission, rejects with a `SendError` when nothing was admitted. */
  readonly send: (text: string) => Promise<unknown>;
  /** The controls rendered on the Send row: stop, archive, end. */
  readonly controls?: ReactNode;
}

function Speaker({ message, actorLogin, actorId }: { message: AgentMessage; actorLogin: string; actorId?: number }) {
  if (message.role === "assistant") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span
          aria-hidden="true"
          className="grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Bot className="size-2.5" />
        </span>
        agent
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {actorId ? (
        <img
          src={`https://avatars.githubusercontent.com/u/${String(actorId)}?s=32`}
          alt=""
          width={16}
          height={16}
          className="size-4 rounded-full border border-border bg-muted"
        />
      ) : (
        <span aria-hidden="true" className="size-4 rounded-full border border-border bg-muted" />
      )}
      {actorLogin}
    </span>
  );
}

function Message({ message, actorLogin, actorId }: { message: AgentMessage; actorLogin: string; actorId?: number }) {
  return (
    <div className="grid gap-1.5">
      <Speaker message={message} actorLogin={actorLogin} actorId={actorId} />
      {message.role === "assistant" ? (
        <Markdown className={cn("text-base", message.streaming && "streaming-caret")}>{message.text}</Markdown>
      ) : (
        <div className="rounded-lg bg-surface px-3 py-2 text-base whitespace-pre-wrap">{message.text}</div>
      )}
    </div>
  );
}

function TurnMarker({ turn }: { turn: Turn }) {
  if (turn.failure) {
    return (
      <div role="status" className="rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
        {failureCopy(turn.failure.code)} <code className="font-mono text-xs opacity-80">{turn.failure.code}</code>
      </div>
    );
  }
  if (turn.status === "cancelled" && turn.cancelReason !== "session_ended") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="size-dot rounded-full bg-status-stopping-dot" />
        Stopped
      </p>
    );
  }
  return null;
}

/** Messages in turn order with each turn's marker after them; messages the log has not placed yet follow. */
function ordered(
  messages: readonly AgentMessage[],
  turns: readonly Turn[],
  actorLogin: string,
  actorId?: number,
): ReactNode[] {
  const placed = new Set<string>();
  const items: ReactNode[] = [];
  for (const turn of turns) {
    for (const message of messages) {
      if (message.turnId !== turn.id) continue;
      placed.add(message.id);
      items.push(<Message key={message.id} message={message} actorLogin={actorLogin} actorId={actorId} />);
    }
    items.push(<TurnMarker key={`marker:${turn.id}`} turn={turn} />);
  }
  for (const message of messages) {
    if (!placed.has(message.id)) {
      items.push(<Message key={message.id} message={message} actorLogin={actorLogin} actorId={actorId} />);
    }
  }
  return items;
}

export function Conversation({
  messages,
  turns,
  actorLogin,
  actorId,
  ended,
  isReplaying,
  connectionError,
  send,
  controls,
}: ConversationProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const text = draft.trim();
  const disabled = ended || sending;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text || disabled) return;
    setSending(true);
    try {
      await send(text);
      // The platform has the input; only now is the draft not needed.
      setDraft("");
    } catch (cause) {
      console.error(cause);
      toast.error(cause instanceof Error ? cause.message : "The follow-up was not sent.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
  }

  const items = ordered(messages, turns, actorLogin, actorId);

  return (
    <section aria-label="Conversation">
      <h3 className="mb-3 text-sm font-medium">Conversation</h3>
      {connectionError ? (
        <p role="alert" className="mb-3 rounded-md bg-status-failed-bg px-3 py-2 text-xs text-status-failed">
          {connectionError}
        </p>
      ) : null}
      {isReplaying && messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading the conversation…</p>
      ) : (
        <div className="grid gap-5">{items}</div>
      )}
      <form onSubmit={submit} className="mt-6 grid gap-3">
        {ended ? <p className="text-sm text-muted-foreground">This task has ended.</p> : null}
        <Textarea
          aria-label="Follow up"
          placeholder={ended ? "" : "Follow up…"}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-[calc(6*var(--leading-base)+2*var(--space-3))] min-h-[calc(2*var(--leading-base)+2*var(--space-3))] field-sizing-content text-base"
        />
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          <Button type="submit" size="lg" disabled={disabled || !text} className="col-span-3 sm:col-auto">
            {sending ? "Sending…" : "Send"}
          </Button>
          <KbdGroup aria-label="Command Enter sends" className="hidden text-muted-foreground sm:inline-flex">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
          <span aria-hidden="true" className="hidden flex-1 sm:block" />
          {controls}
        </div>
      </form>
    </section>
  );
}
