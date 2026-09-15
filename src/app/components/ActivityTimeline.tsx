import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Turn, TurnStatus } from "@/reducer";
import { failureCopy } from "@/vocabulary";
import { RelativeTime } from "./RelativeTime";
import { ToolCallRow } from "./ToolCall";

const RULE_DOT: Record<TurnStatus, string> = {
  queued: "bg-status-queued-dot",
  running: "bg-status-working-dot status-dot-pulse",
  completed: "bg-status-idle-dot",
  failed: "bg-status-failed-dot",
  cancelled: "bg-status-stopping-dot",
};

function TurnGroup({
  turn,
  number,
  expanded,
  onToggle,
}: {
  turn: Turn;
  number: number;
  expanded: ReadonlySet<string>;
  onToggle: (callId: string) => void;
}) {
  return (
    <section aria-label={`Turn ${String(number)}`} className="mt-4 first:mt-0">
      <h4 className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span aria-hidden className={cn("size-dot rounded-full", RULE_DOT[turn.status])} />
        <span>
          Turn {String(number)} · <RelativeTime iso={turn.createdAt} />
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </h4>
      {turn.toolCalls.length ? (
        <ul>
          {turn.toolCalls.map((call) => (
            <ToolCallRow
              key={call.callId}
              call={call}
              expanded={expanded.has(call.callId)}
              onToggle={() => onToggle(call.callId)}
            />
          ))}
        </ul>
      ) : turn.status === "running" ? (
        <p className="flex min-h-row-compact items-center gap-2 border-b border-border text-sm text-muted-foreground">
          <span aria-hidden className="size-dot rounded-full bg-status-working-dot status-dot-pulse" />
          Thinking
        </p>
      ) : null}
      {turn.failure ? (
        <p role="status" className="mt-2 rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
          {failureCopy(turn.failure.code)} <code className="font-mono text-xs">{turn.failure.code}</code>
        </p>
      ) : null}
    </section>
  );
}

/** Turn boundaries and tool calls from the log; expansion is keyed by call id so it survives new events. */
export function ActivityTimeline({ turns, isReplaying }: { turns: readonly Turn[]; isReplaying: boolean }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (callId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  return (
    <section aria-label="Activity">
      <h3 className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Activity</h3>
      {turns.length ? (
        turns.map((turn, index) => (
          <TurnGroup key={turn.id} turn={turn} number={index + 1} expanded={expanded} onToggle={toggle} />
        ))
      ) : isReplaying ? (
        <div role="status" aria-busy="true" aria-label="Loading activity">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex h-row-compact items-center border-b border-border">
              <span className="h-3 w-1/2 rounded-sm bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
      )}
    </section>
  );
}
