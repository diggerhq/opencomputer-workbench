// One row of the list: exactly one row height whatever it holds, the badge,
// the title with the repository and base, the actor and age, the result
// stage when present, and the archive control reserved on every row. The
// title is the link; it covers the row, and the archive control sits above
// it so the two never nest.
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/api";
import { absoluteTime, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { displayStateOf, needsAttention, StatusBadge } from "./StatusBadge";

export function TaskRow({
  task,
  now,
  onArchive,
  archiving = false,
}: {
  task: Task;
  now: number;
  onArchive: (task: Task) => void;
  archiving?: boolean;
}) {
  const state = displayStateOf(task);
  const stage = task.result && task.result.stage !== "none" ? task.result.stage : undefined;
  const muted = state === "archived" || state === "ended";
  return (
    <li
      className={cn(
        "group relative -ml-[3px] grid h-row grid-cols-[auto_minmax(0,1fr)_--spacing(7)] grid-rows-2 items-center gap-x-3 border-b border-l-[3px] border-border md:grid-cols-[--spacing(44)_minmax(0,1fr)_--spacing(32)] md:gap-x-4",
        needsAttention(task) ? "border-l-attention" : "border-l-transparent",
      )}
    >
      <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-1">
        <StatusBadge state={state} queued={task.queued} />
        {stage ? <span className="text-xs text-muted-foreground md:hidden">· {stage}</span> : null}
      </span>
      <span className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-3">
        <Link
          to="/tasks/$id"
          params={{ id: task.id }}
          className={cn(
            "min-w-0 truncate font-medium after:absolute after:inset-0 after:content-['']",
            muted && "text-muted-foreground",
          )}
        >
          {task.title}
        </Link>
        <span className="hidden shrink-0 font-mono text-sm text-muted-foreground md:inline">
          {task.repo} · {task.ref}
        </span>
      </span>
      <span className="col-span-2 col-start-1 row-start-2 flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground md:col-span-1 md:col-start-2">
        {task.actor.id ? (
          <img
            src={`https://avatars.githubusercontent.com/u/${String(task.actor.id)}?s=32`}
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-full border border-border bg-muted"
          />
        ) : (
          <span aria-hidden="true" className="size-4 rounded-full border border-border bg-muted" />
        )}
        <span>{task.actor.login || "unknown"}</span>
        <span className="font-mono md:hidden">
          · {task.repo} · {task.ref}
        </span>
        <span>·</span>
        <time dateTime={absoluteTime(task.createdAt)} title={absoluteTime(task.createdAt)}>
          {relativeTime(task.createdAt, now)}
        </time>
      </span>
      <span className="col-start-3 row-span-2 row-start-1 flex items-center justify-center gap-3 text-xs text-muted-foreground md:justify-end">
        {stage ? <span className="hidden md:inline">{stage}</span> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "relative z-10 text-muted-foreground",
            !task.archived && "md:invisible md:group-focus-within:visible md:group-hover:visible",
          )}
          aria-label={task.archived ? "Unarchive" : "Archive"}
          disabled={archiving}
          onClick={() => onArchive(task)}
        >
          {task.archived ? <ArchiveRestore /> : <Archive />}
        </Button>
      </span>
    </li>
  );
}
