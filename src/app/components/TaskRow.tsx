// One row of the list: one row height whatever it holds, three columns that
// every row renders (status, title with its meta line, stage with the
// archive control), so their edges line up down the list. Rows are not
// divided by lines: the rhythm inside the row (title, then the meta line)
// and the hover tint separate them. The title is the link; it covers the
// row, and the archive control sits above it so the two never nest. A row
// that needs attention carries the attention tint across its whole surface,
// never a border. Below md the status folds into the meta line and the stage
// word is dropped.
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Task } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ActorAvatar } from "./ActorAvatar";
import { RelativeTime } from "./RelativeTime";
import { displayStateOf, needsAttention, StatusBadge } from "./StatusBadge";

export function TaskRow({
  task,
  onArchive,
  archiving = false,
}: {
  task: Task;
  onArchive: (task: Task) => void;
  archiving?: boolean;
}) {
  const state = displayStateOf(task);
  const stage = task.result && task.result.stage !== "none" ? task.result.stage : undefined;
  const muted = state === "archived" || state === "ended";
  const attention = needsAttention(task);
  return (
    <li
      data-slot="task-row"
      className={cn(
        "group relative flex h-16 items-center gap-4 px-5 hover:bg-hover focus-within:bg-hover",
        attention && "bg-attention-row",
      )}
    >
      <span data-col="status" className="hidden w-32 shrink-0 md:block">
        <StatusBadge state={state} queued={task.queued} />
      </span>
      <span data-col="title" className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Link
          to="/tasks/$id"
          params={{ id: task.id }}
          className={cn(
            "stretched min-w-0 truncate rounded-sm text-base font-medium outline-offset-0",
            muted && "text-muted-foreground",
          )}
        >
          {task.title}
        </Link>
        <span className="flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
          <span className="md:hidden">
            <StatusBadge state={state} queued={task.queued} />
          </span>
          <ActorAvatar id={task.actor.id} className="size-4" />
          <span>{task.actor.login || "unknown"}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-mono">
            {task.repo}
            <span aria-hidden="true" className="mx-1 opacity-50">
              /
            </span>
            {task.ref}
          </span>
          <span aria-hidden="true">·</span>
          <RelativeTime iso={task.createdAt} />
        </span>
      </span>
      <span data-col="stage" className="flex w-8 shrink-0 items-center justify-end gap-3 md:w-32">
        {stage ? <span className="hidden text-xs text-muted-foreground md:inline">{stage}</span> : null}
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent side="left">{task.archived ? "Unarchive" : "Archive"}</TooltipContent>
        </Tooltip>
      </span>
    </li>
  );
}
