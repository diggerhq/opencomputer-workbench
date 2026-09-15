import { ArrowUpRight, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Report, ReportStage } from "../../lib/report";
import { shortSha } from "./format";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-16 shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  );
}

function Sha({ value }: { value: string }) {
  return (
    <span className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs" title={value}>
      {shortSha(value)}
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-sm font-medium text-accent hover:underline"
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

/**
 * The reported fields as a definition list: only what the report carries,
 * absent fields are absent rows. The result card and the report tool's
 * timeline entry share it. `repo` enables the compare link; `baseRef` is the
 * requested base, shown beside the resolved sha.
 */
export function ResultFields({ report, repo, baseRef }: { report: Report; repo?: string; baseRef?: string }) {
  const compare = repo && report.baseSha && report.commit;
  return (
    <dl className="grid gap-2 text-sm">
      {report.baseSha ? (
        <Row term="base">
          <Sha value={report.baseSha} />
          {baseRef ? <span className="ml-1.5 text-muted-foreground">{baseRef}</span> : null}
        </Row>
      ) : null}
      {report.branch ? (
        <Row term="branch">
          <span className="font-mono text-xs">{report.branch}</span>
        </Row>
      ) : null}
      {report.commit ? (
        <Row term="commit">
          <Sha value={report.commit} />
        </Row>
      ) : null}
      {report.pr ? (
        <Row term="PR">
          <ExternalLink href={report.pr.url}>
            #{String(report.pr.number)}
            {report.pr.draft ? " draft" : ""}
          </ExternalLink>
        </Row>
      ) : null}
      {report.checks?.length ? (
        <Row term="checks">
          <ul className="grid gap-1.5">
            {report.checks.map((check) => (
              <li key={check.command} className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-mono text-xs">{check.command}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    check.passed ? "text-status-ready-for-review" : "text-status-failed",
                  )}
                >
                  {check.passed ? (
                    <Check aria-label="passed" className="size-3.5" />
                  ) : (
                    <X aria-label="failed" className="size-3.5" />
                  )}
                  {check.summary}
                </span>
                <span className="text-xs text-muted-foreground">(reported)</span>
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
      {compare ? (
        <Row term="">
          <ExternalLink href={`https://github.com/${repo}/compare/${report.baseSha}...${report.commit}`}>
            Compare {shortSha(report.baseSha ?? "")}…{shortSha(report.commit ?? "")}
          </ExternalLink>
        </Row>
      ) : null}
    </dl>
  );
}

export interface ResultCardProps {
  readonly report: Report;
  readonly stage: ReportStage;
  /** "turn 1" from the log, or the row's turn until the log has replayed. */
  readonly reportedBy: string;
  /** The reporting turn is the last settled one; otherwise the card says which turn it came from. */
  readonly fromLastTurn: boolean;
  readonly repo?: string;
  readonly baseRef?: string;
}

/** The session's result with its provenance. Rendered only when there is one; the page says "No result reported yet" otherwise. */
export function ResultCard({ report, stage, reportedBy, fromLastTurn, repo, baseRef }: ResultCardProps) {
  return (
    <section aria-label="Result" className="grid gap-2">
      <div className="flex h-5 items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Result</h3>
        <span className="text-xs text-muted-foreground">reported by {reportedBy}</span>
      </div>
      <Card>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(fromLastTurn && "bg-status-ready-for-review-bg text-status-ready-for-review")}
            >
              {stage}
            </Badge>
            {fromLastTurn ? null : (
              <p className="text-sm text-muted-foreground">
                Finished, no new changes reported · result from {reportedBy}
              </p>
            )}
          </div>
          <ResultFields report={report} repo={repo} baseRef={baseRef} />
        </CardContent>
      </Card>
    </section>
  );
}
