import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { type CommandOutcome, commandOf, commandOutcome, type ToolCall } from "@/reducer";
import { reportSchema } from "../../lib/report";
import { formatDuration } from "./format";
import { ResultFields } from "./ResultCard";

/** Lines shown before the expander asks; nothing is ever cut without saying so. */
const PREVIEW_LINES = 40;

function Outcome({ outcome }: { outcome: CommandOutcome }) {
  const duration = formatDuration(outcome.durationMs);
  const lines = outcome.lines ? `${String(outcome.lines)} lines` : "";
  switch (outcome.kind) {
    case "running":
      return (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="size-dot rounded-full bg-status-working-dot status-dot-pulse" />
          running
        </span>
      );
    case "ok":
      return (
        <span className="text-xs text-status-ready-for-review">✓ {[duration, lines].filter(Boolean).join(" · ")}</span>
      );
    case "error":
      return (
        <span className="text-xs text-status-failed">
          ✗ exit {String(outcome.exitCode)}
          {duration ? ` · ${duration}` : ""}
        </span>
      );
    case "timed_out":
      return <span className="text-xs text-status-failed">timed out{duration ? ` after ${duration}` : ""}</span>;
    case "failed":
      return <span className="text-xs text-status-failed">✗ failed</span>;
  }
}

function OutputBlock({ text }: { text: string }) {
  const [showAll, setShowAll] = useState(false);
  const lines = text.replace(/\n$/, "").split("\n");
  const hidden = showAll ? 0 : Math.max(0, lines.length - PREVIEW_LINES);
  const shown = hidden ? lines.slice(0, PREVIEW_LINES) : lines;
  return (
    <pre className="mt-2 overflow-hidden rounded-md border border-code-border bg-code p-3 font-mono text-sm whitespace-pre-wrap text-code-foreground [overflow-wrap:anywhere]">
      {shown.join("\n")}
      {hidden ? (
        <span className="mt-2 block text-muted-foreground">
          …and {String(hidden)} more lines ·{" "}
          <button type="button" className="text-accent hover:underline" onClick={() => setShowAll(true)}>
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
    <div className="mt-2">
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
    <li data-call-id={call.callId} className="min-h-row-compact border-b border-border py-2 text-sm">
      <div className="grid grid-cols-[1rem_auto_minmax(0,1fr)_auto] items-center gap-x-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide output" : "Show output"}
          onClick={onToggle}
          className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight aria-hidden className={cn("size-4", expanded && "rotate-90")} />
        </button>
        <span className="font-medium">{call.tool}</span>
        <span className="truncate font-mono text-muted-foreground" title={command || undefined}>
          {command}
        </span>
        <Outcome outcome={outcome} />
      </div>
      {expanded ? (
        <div className="pl-6">
          {call.tool === "report" ? (
            <ReportBody call={call} />
          ) : hasBody ? (
            <OutputBlock text={outcome.text} />
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {outcome.kind === "running" ? "No output yet." : "No output."}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
