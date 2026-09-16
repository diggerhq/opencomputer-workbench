import { Check, ChevronRight, Clock, X } from "lucide-react";
import { useState } from "react";
import { type CommandOutcome, commandOf, commandOutcome, parseOutput, type ToolCall } from "@/lib/activity";
import { formatDuration } from "@/lib/format";
import { reportSchema } from "@/shared/report";
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
          <span aria-hidden="true" className="size-2 rounded-full bg-status-working-dot status-dot-pulse" />
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
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-status-stopping">
          <X aria-hidden="true" className="size-3.5" />
          <span>stopped{duration ? ` after ${duration}` : ""}</span>
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
    <pre className="my-2 overflow-hidden rounded-md bg-code px-3 py-2 font-mono text-xs leading-5 wrap-anywhere whitespace-pre-wrap text-code-foreground">
      {shown.join("\n")}
      {hidden ? (
        <span className="mt-2 block pt-2 text-muted-foreground">
          <span aria-hidden="true" className="mb-2 block h-px bg-code-border" />
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
  const output = parseOutput(call.output) ?? call.input;
  const parsed = reportSchema.safeParse(output);
  if (!parsed.success) return <OutputBlock text={JSON.stringify(output ?? {}, null, 2)} />;
  return (
    <div className="my-2 rounded-md bg-surface p-3">
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
    <li data-call-id={call.callId} className="min-w-0 text-sm">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide output" : "Show output"}
        onClick={onToggle}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover"
      >
        <ChevronRight aria-hidden="true" className="chevron size-4 shrink-0 text-muted-foreground" />
        <span className="w-14 shrink-0 truncate text-xs text-muted-foreground">{call.tool}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={command || undefined}>
          {command}
        </span>
        <span className="shrink-0">
          <Outcome outcome={outcome} />
        </span>
      </button>
      {expanded ? (
        <div className="pb-1 pl-8">
          {call.tool === "report" ? (
            <ReportBody call={call} />
          ) : hasBody ? (
            <OutputBlock text={outcome.text} />
          ) : (
            <p className="my-2 text-xs text-muted-foreground">
              {outcome.kind === "running" ? "No output yet." : "No output."}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
