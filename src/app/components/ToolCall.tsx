import { Check, ChevronRight, Clock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { type CommandOutcome, commandOf, commandOutcome, type ToolCall } from "@/reducer";
import { reportSchema } from "../../lib/report";
import { formatDuration } from "./format";
import { ResultFields } from "./ResultCard";

/** Lines shown before the expander asks; nothing is ever cut without saying so. */
const PREVIEW_LINES = 40;

/** What a call's row says on the right: the icon carries the outcome, the text the measure. */
function Outcome({ outcome }: { outcome: CommandOutcome }) {
  const duration = formatDuration(outcome.durationMs);
  const lines = outcome.lines ? `${String(outcome.lines)} lines` : "";
  switch (outcome.kind) {
    case "running":
      return (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-dot rounded-full bg-status-working-dot status-dot-pulse" />
          running
        </span>
      );
    case "ok":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-status-ready-for-review">
          <Check aria-label="passed" className="size-3.5" />
          <span className="text-muted-foreground">{[duration, lines].filter(Boolean).join(" · ")}</span>
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-status-failed">
          <X aria-label="failed" className="size-3.5" />
          <span>
            exit {String(outcome.exitCode)}
            {duration ? ` · ${duration}` : ""}
          </span>
        </span>
      );
    case "timed_out":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-status-failed">
          <Clock aria-hidden="true" className="size-3.5" />
          <span>timed out{duration ? ` after ${duration}` : ""}</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-status-failed">
          <X aria-hidden="true" className="size-3.5" />
          <span>failed</span>
        </span>
      );
  }
}

function OutputBlock({ text }: { text: string }) {
  const [showAll, setShowAll] = useState(false);
  const lines = text.replace(/\n$/, "").split("\n");
  const hidden = showAll ? 0 : Math.max(0, lines.length - PREVIEW_LINES);
  const shown = hidden ? lines.slice(0, PREVIEW_LINES) : lines;
  return (
    <pre className="mt-2 mb-1 overflow-hidden rounded-md border border-code-border bg-code px-3 py-2.5 font-mono text-xs leading-5 whitespace-pre-wrap text-code-foreground [overflow-wrap:anywhere]">
      {shown.join("\n")}
      {hidden ? (
        <span className="mt-2 block border-t border-code-border pt-2 text-muted-foreground">
          …and {String(hidden)} more lines ·{" "}
          <button
            type="button"
            className="rounded-sm text-code-foreground underline underline-offset-2 hover:text-accent-foreground"
            onClick={() => setShowAll(true)}
          >
            Show all
          </button>
        </span>
      ) : null}
    </pre>
  );
}

function ReportBody({ call }: { call: ToolCall }) {
  const parsed = reportSchema.safeParse(call.output ?? call.input);
  if (!parsed.success) return <OutputBlock text={JSON.stringify(call.output ?? call.input ?? {}, null, 2)} />;
  return (
    <div className="mt-2 mb-1 rounded-md border border-border bg-surface p-3">
      <ResultFields report={parsed.data} />
    </div>
  );
}

/** One timeline entry: the chevron, the tool, its command, the outcome; the output when expanded. */
export function ToolCallRow({ call, expanded, onToggle }: { call: ToolCall; expanded: boolean; onToggle: () => void }) {
  const outcome = commandOutcome(call);
  const command = call.tool === "report" ? "" : commandOf(call);
  const hasBody = call.tool === "report" || outcome.text.length > 0;
  return (
    <li data-call-id={call.callId} className="min-h-row-compact text-sm">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide output" : "Show output"}
        onClick={onToggle}
        className={cn(
          "grid h-row-compact w-full grid-cols-[1rem_--spacing(14)_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 text-left hover:bg-hover",
          "-mx-2 w-[calc(100%+--spacing(4))]",
        )}
      >
        <ChevronRight aria-hidden="true" className="chevron size-4 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-muted-foreground">{call.tool}</span>
        <span className="truncate font-mono text-xs text-foreground" title={command || undefined}>
          {command}
        </span>
        <Outcome outcome={outcome} />
      </button>
      {expanded ? (
        <div className="pl-6">
          {call.tool === "report" ? (
            <ReportBody call={call} />
          ) : hasBody ? (
            <OutputBlock text={outcome.text} />
          ) : (
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              {outcome.kind === "running" ? "No output yet." : "No output."}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
