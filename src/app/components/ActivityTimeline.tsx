import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

const RULE_WORD: Record<TurnStatus, { word: string; tone: string }> = {
  queued: { word: "queued", tone: "text-muted-foreground" },
  running: { word: "in progress", tone: "text-status-working" },
  completed: { word: "completed", tone: "text-muted-foreground" },
  failed: { word: "failed", tone: "text-status-failed" },
  cancelled: { word: "stopped", tone: "text-status-stopping" },
};

/** "after 1.2 s, 2 commands stopped, computer replaced": what `turn.cancelled` recorded about the stop. */
function settlementWords(settlement: NonNullable<Turn["settlement"]>): string {
  const parts: string[] = [];
  if (settlement.afterMs !== undefined) parts.push(`after ${(settlement.afterMs / 1000).toFixed(1)} s`);
  if (settlement.operations) {
    parts.push(`${String(settlement.operations)} command${settlement.operations === 1 ? "" : "s"} stopped`);
  }
  if (settlement.computerTerminated) parts.push("computer replaced");
  return parts.length ? `(${parts.join(", ")})` : "";
}

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
  const rule = RULE_WORD[turn.status];
  return (
    <section aria-label={`Turn ${String(number)}`} className="px-3 py-3">
      <h4 className="flex h-8 items-center gap-2 px-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className={cn("size-2 rounded-full", RULE_DOT[turn.status])} />
        <span className="font-medium text-foreground">Turn {String(number)}</span>
        <span aria-hidden="true">·</span>
        <RelativeTime iso={turn.createdAt} />
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className={rule.tone}>
          {rule.word}
          {turn.settlement ? ` ${settlementWords(turn.settlement)}` : ""}
        </span>
      </h4>
      {turn.toolCalls.length ? (
        <ul className="mt-1 flex flex-col gap-0.5">
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
        <p className="flex h-8 items-center gap-2 px-2 text-sm text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full bg-status-working-dot status-dot-pulse" />
          Thinking
        </p>
      ) : null}
      {turn.failure ? (
        <p role="status" className="mx-2 mt-3 rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
          {failureCopy(turn.failure.code)} <code className="font-mono text-xs opacity-80">{turn.failure.code}</code>
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
  const calls = turns.reduce((count, turn) => count + turn.toolCalls.length, 0);
  return (
    <Card data-slot="activity" role="region" aria-label="Activity" className="gap-0 py-0">
      <div className="flex h-12 items-center justify-between gap-4 bg-surface px-5">
        <h3 className="text-sm font-medium">Activity</h3>
        {turns.length ? (
          <span className="text-xs text-muted-foreground">
            {String(turns.length)} {turns.length === 1 ? "turn" : "turns"} · {String(calls)}{" "}
            {calls === 1 ? "call" : "calls"}
          </span>
        ) : null}
      </div>
      {turns.length ? (
        <div className="divide-y">
          {turns.map((turn, index) => (
            <TurnGroup key={turn.id} turn={turn} number={index + 1} expanded={expanded} onToggle={toggle} />
          ))}
        </div>
      ) : isReplaying ? (
        <div role="status" aria-busy="true" aria-label="Loading activity" className="divide-y px-5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex h-8 items-center">
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <p className="flex min-h-32 items-center justify-center px-5 text-sm text-muted-foreground">
          Nothing has run yet.
        </p>
      )}
    </Card>
  );
}
