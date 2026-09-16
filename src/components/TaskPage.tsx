// The task page: the task's facets from the tasks route, the activity from
// the event log through the hook, and the controls that write labels or end
// the session. The row's execution facet is OpenComputer's: the page refetches
// it when the log settles a turn and every few seconds while a turn runs,
// with the hook's `isRunning` as the trigger, never a watchdog of its own.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FolderGit2, Hash, Link2, SearchX } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ActorAvatar } from "@/components/ActorAvatar";
import { Controls } from "@/components/Controls";
import { Conversation } from "@/components/Conversation";
import { Markdown } from "@/components/Markdown";
import { RelativeTime } from "@/components/RelativeTime";
import { ResultCard, type ResultCardProps } from "@/components/ResultCard";
import { displayStateOf, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity } from "@/components/use-activity";
import { type Activity, activeTurn, isSettled, latestResult } from "@/lib/activity";
import { ApiError, endTask, getTask, patchTask, type Task } from "@/lib/api";
import { type Report, type ReportStage, reportStage } from "@/shared/report";

export const taskQueryKey = (id: string) => ["task", id] as const;

/** Refetch cadence while a turn runs; the log settling a turn triggers a refetch on its own. */
const RUNNING_REFETCH_MS = 5_000;

/**
 * The result the card shows. The log's, once replayed: it carries the
 * reporting turn's number and whether that turn is the last settled one.
 * The row's until then, with the turn id as its provenance. Both describe
 * the same committed result, so when both exist the log wins: the row is a
 * projection that can lag the log by a publication.
 */
function resultFor(activity: Activity, task: Task | undefined): Omit<ResultCardProps, "repo" | "baseRef"> | undefined {
  const fromLog = latestResult(activity);
  if (fromLog) {
    return {
      report: fromLog.report,
      stage: fromLog.stage,
      reportedBy: `turn ${String(fromLog.turnNumber)}`,
      fromLastTurn: fromLog.fromLastTurn,
    };
  }
  if (!task?.result) return undefined;
  const { turnId, reportedAt: _reportedAt, stage: _stage, fromLastTurn, ...fields } = task.result;
  const report: Report = fields;
  const stage: ReportStage = reportStage(report);
  if (stage === "none") return undefined;
  return { report, stage, reportedBy: `turn ${turnId.slice(0, 8)}`, fromLastTurn };
}

function Meta({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5" title={title}>
      {children}
    </span>
  );
}

function Header({ task, id }: { task: Task | undefined; id: string }) {
  if (!task) {
    return (
      <header aria-busy="true" className="grid gap-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </header>
    );
  }
  return (
    <header className="grid gap-3">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <h2 className="min-w-0 text-xl font-medium tracking-tight">{task.title}</h2>
        <StatusBadge state={displayStateOf(task)} queued={task.queued} variant="full" className="shrink-0" />
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <Meta>
          <FolderGit2 aria-hidden="true" className="size-3.5" />
          <span className="font-mono text-xs">
            {task.repo}
            <span className="mx-1 text-border">/</span>
            {task.ref}
          </span>
        </Meta>
        <Meta>
          <ActorAvatar id={task.actor.id} />
          {task.actor.login || "unknown"}
        </Meta>
        <Meta>
          <RelativeTime iso={task.createdAt} prefix="started" />
        </Meta>
        <Meta title={id}>
          <Hash aria-hidden="true" className="size-3.5" />
          <span className="font-mono text-xs">{id.slice(0, 8)}</span>
        </Meta>
        {task.continues ? (
          <Link
            to="/tasks/$id"
            params={{ id: task.continues }}
            className="inline-flex h-5 items-center gap-1.5 rounded-sm hover:text-foreground"
          >
            <Link2 aria-hidden="true" className="size-3.5" />
            continues <span className="font-mono text-xs">{task.continues.slice(0, 8)}</span>
          </Link>
        ) : null}
      </p>
    </header>
  );
}

function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full bg-surface text-muted-foreground"
      >
        <SearchX className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground" role="alert">
        No such task.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/">← Tasks</Link>
      </Button>
    </main>
  );
}

export function TaskPage({ id }: { id: string }) {
  const client = useQueryClient();
  const { activity, messages, isReplaying, isRunning, error, send, stop } = useActivity(id);
  const task = useQuery({
    queryKey: taskQueryKey(id),
    queryFn: () => getTask(id),
    retry: (count, cause) => !(cause instanceof ApiError && cause.status === 404) && count < 2,
    refetchInterval: isRunning ? RUNNING_REFETCH_MS : false,
  });

  // The log settling a turn (or ending the session) means the row changed:
  // refetch it then, apart from the first render, which the query does.
  const settled = activity.turns.filter(isSettled).length;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    const mark = `${String(settled)}:${String(activity.ended)}`;
    if (seen.current === undefined) {
      seen.current = mark;
      return;
    }
    if (seen.current === mark) return;
    seen.current = mark;
    void client.invalidateQueries({ queryKey: taskQueryKey(id) });
  }, [client, id, settled, activity.ended]);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: taskQueryKey(id) });
    void client.invalidateQueries({ queryKey: ["tasks"] });
  };
  const report = (cause: unknown) => {
    console.error(cause);
    toast.error(cause instanceof Error ? cause.message : "The change was not saved.");
  };
  const archive = useMutation({
    mutationFn: (archived: boolean) => patchTask(id, { archived }),
    onSuccess: (updated) => client.setQueryData(taskQueryKey(id), updated),
    onError: report,
    onSettled: invalidate,
  });
  const end = useMutation({
    mutationFn: () => endTask(id),
    onSuccess: (updated) => client.setQueryData(taskQueryKey(id), updated),
    onError: report,
    onSettled: invalidate,
  });

  if (task.isError && task.error instanceof ApiError && task.error.status === 404) return <NotFound />;

  const current = task.data;
  const ended = activity.ended || current?.execution === "ended";
  const first = activity.turns[0];
  const running = activeTurn(activity);
  const result = resultFor(activity, current);
  const failureMessages = new Set(activity.turns.map((turn) => turn.failure?.message).filter(Boolean));
  const connectionError = error && !failureMessages.has(error) ? error : undefined;
  const actorLogin = current?.actor.login || "you";

  return (
    <main className="flex flex-1 flex-col gap-8 pt-8 pb-24">
      <div className="flex h-8 items-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tasks
        </Link>
      </div>
      <Header task={current} id={id} />
      {task.isError ? (
        <p role="alert" className="rounded-md bg-status-failed-bg px-3 py-2 text-xs text-status-failed">
          {task.error.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10">
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-10">
          <section aria-label="Request" className="order-1 grid gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Request</h3>
            {first ? (
              <Card>
                <CardContent>
                  <Markdown className="text-md">{first.input}</Markdown>
                </CardContent>
              </Card>
            ) : isReplaying ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : (
              <p className="text-sm text-muted-foreground">The request has not been admitted yet.</p>
            )}
          </section>
          <div className="order-2">
            {result ? (
              <ResultCard {...result} repo={current?.repo} baseRef={current?.ref} />
            ) : isReplaying || task.isPending ? null : (
              <section aria-label="Result" className="grid gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Result</h3>
                <p className="rounded-xl border border-dashed px-5 py-4 text-sm text-muted-foreground">
                  No result reported yet
                </p>
              </section>
            )}
          </div>
          <div className="order-4">
            <Conversation
              messages={messages}
              turns={activity.turns}
              actorLogin={actorLogin}
              actorId={current?.actor.id || undefined}
              ended={ended}
              isReplaying={isReplaying}
              connectionError={connectionError}
              send={send}
              controls={
                <Controls
                  isRunning={isRunning}
                  activeTurnId={running?.id}
                  ended={ended}
                  archived={current?.archived ?? false}
                  onStop={() =>
                    // The published hook rejects when the interrupt request was
                    // not answered with success; settlement itself arrives in turns.
                    stop().catch((cause: unknown) => {
                      console.error(cause);
                      toast.error(cause instanceof Error ? cause.message : "The stop was not requested.");
                    })
                  }
                  onArchive={current && !archive.isPending ? () => archive.mutate(!current.archived) : undefined}
                  onEnd={current && !end.isPending ? () => end.mutate() : undefined}
                />
              }
            />
          </div>
        </div>
        <aside className="order-3 lg:order-none lg:col-span-7">
          <ActivityTimeline turns={activity.turns} isReplaying={isReplaying} />
        </aside>
      </div>
    </main>
  );
}
