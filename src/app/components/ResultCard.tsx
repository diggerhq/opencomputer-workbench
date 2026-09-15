import { ArrowUpRight } from "lucide-react";
import type { LatestResult } from "@/reducer";
import type { Report } from "../../../opencomputer/agents/worker/tools/report";
import { shortSha } from "./format";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
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
    <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {report.baseSha ? (
        <Row term="base">
          <span className="font-mono">{shortSha(report.baseSha)}</span>
          {baseRef ? <span className="text-muted-foreground"> {baseRef}</span> : null}
        </Row>
      ) : null}
      {report.branch ? (
        <Row term="branch">
          <span className="font-mono">{report.branch}</span>
        </Row>
      ) : null}
      {report.commit ? (
        <Row term="commit">
          <span className="font-mono">{shortSha(report.commit)}</span>
        </Row>
      ) : null}
      {report.pr ? (
        <Row term="PR">
          <a
            href={report.pr.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            #{String(report.pr.number)}
            {report.pr.draft ? " draft" : ""}
            <ArrowUpRight aria-hidden className="size-3" />
          </a>
        </Row>
      ) : null}
      {report.checks?.length ? (
        <Row term="checks">
          <ul className="space-y-1">
            {report.checks.map((check) => (
              <li key={check.command}>
                <span className="font-mono">{check.command}</span>{" "}
                <span className={check.passed ? "text-status-ready-for-review" : "text-status-failed"}>
                  {check.passed ? "✓" : "✗"}
                </span>{" "}
                {check.summary} <span className="text-muted-foreground">(reported)</span>
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
      {compare ? (
        <Row term="">
          <a
            href={`https://github.com/${repo}/compare/${report.baseSha}...${report.commit}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Compare {shortSha(report.baseSha ?? "")}…{shortSha(report.commit ?? "")}
            <ArrowUpRight aria-hidden className="size-3" />
          </a>
        </Row>
      ) : null}
    </dl>
  );
}

/** The session's result with its provenance. Rendered only when there is one; the page says "No result reported yet" otherwise. */
export function ResultCard({ result, repo, baseRef }: { result: LatestResult; repo?: string; baseRef?: string }) {
  return (
    <section aria-label="Result">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Result</h3>
        <span className="text-xs text-muted-foreground">reported by turn {String(result.turnNumber)}</span>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {result.fromLastTurn ? (
          <p className="mb-3 text-sm font-medium text-status-ready-for-review">{result.stage}</p>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">
            Finished, no new changes reported · result from turn {String(result.turnNumber)}
          </p>
        )}
        <ResultFields report={result.report} repo={repo} baseRef={baseRef} />
      </div>
    </section>
  );
}
