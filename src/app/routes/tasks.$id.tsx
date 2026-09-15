import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Controls } from "@/components/Controls";
import { Conversation } from "@/components/Conversation";
import { firstLine } from "@/components/format";
import { RelativeTime } from "@/components/RelativeTime";
import { ResultCard } from "@/components/ResultCard";
import { useActivity } from "@/hooks/use-activity";
import { activeTurn, latestResult } from "@/reducer";

export const Route = createFileRoute("/tasks/$id")({
  component: TaskPage,
});

interface PageHeaderProps {
  readonly taskId: string;
  readonly title?: string;
  readonly repo?: string;
  readonly ref?: string;
  readonly actorLogin?: string;
  readonly startedAt?: string;
}

// The title row and its meta line. The task's facets (repository, base,
// actor, status) come from the tasks route once the tasks stream lands; this
// header renders whichever it is given.
function PageHeader({ taskId, title, repo, ref, actorLogin, startedAt }: PageHeaderProps) {
  return (
    <header className="mt-2">
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <h2 className="min-w-0 text-lg font-medium">{title ?? "Task"}</h2>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-2 text-sm text-muted-foreground">
        {repo ? (
          <span className="font-mono">
            {repo}
            {ref ? ` at ${ref}` : ""}
          </span>
        ) : null}
        {actorLogin ? <span>{actorLogin}</span> : null}
        <RelativeTime iso={startedAt} prefix="started" />
        <span className="font-mono" title={taskId}>
          task {taskId.slice(0, 8)}…
        </span>
      </p>
    </header>
  );
}

function TaskPage() {
  const { id } = Route.useParams();
  const { activity, messages, isReplaying, isRunning, error, send, stop } = useActivity(id);
  const result = latestResult(activity);
  const first = activity.turns[0];
  const running = activeTurn(activity);
  const failureMessages = new Set(activity.turns.map((turn) => turn.failure?.message).filter(Boolean));
  const connectionError = error && !failureMessages.has(error) ? error : undefined;

  return (
    <main className="flex flex-1 flex-col pb-12">
      <div className="flex h-row items-center">
        <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Tasks
        </Link>
      </div>
      <PageHeader taskId={id} title={first ? firstLine(first.input) : undefined} startedAt={activity.createdAt} />
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <section aria-label="Request" className="order-1">
            <h3 className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Request</h3>
            {first ? (
              <div className="rounded-lg border border-border bg-card p-4 text-md whitespace-pre-wrap">
                {first.input}
              </div>
            ) : isReplaying ? (
              <div aria-busy className="h-24 rounded-lg border border-border bg-card" />
            ) : (
              <p className="text-sm text-muted-foreground">The request has not been admitted yet.</p>
            )}
          </section>
          <div className="order-2">
            {result ? (
              <ResultCard result={result} />
            ) : isReplaying ? null : (
              <p className="text-sm text-muted-foreground">No result reported yet</p>
            )}
          </div>
          <div className="order-4">
            <Conversation
              messages={messages}
              turns={activity.turns}
              actorLogin="you"
              ended={activity.ended}
              isReplaying={isReplaying}
              connectionError={connectionError}
              send={send}
              controls={
                <Controls
                  isRunning={isRunning}
                  activeTurnId={running?.id}
                  ended={activity.ended}
                  archived={false}
                  onStop={stop}
                />
              }
            />
          </div>
        </div>
        <aside className="order-3 lg:sticky lg:top-4 lg:order-none lg:col-span-7 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
          <ActivityTimeline turns={activity.turns} isReplaying={isReplaying} />
        </aside>
      </div>
    </main>
  );
}
