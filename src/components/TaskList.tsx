// The list: one OpenComputer call per page, rows mapped on the server, the
// cursor passed through. Loading shows skeleton rows of the row height and
// never a partial row; an error replaces the rows with the code and a retry;
// the last page says so.
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listTasks, patchTask, type Task } from "@/lib/api";
import { TaskRow } from "./TaskRow";

export function useTasks(archived: boolean) {
  return useInfiniteQuery({
    queryKey: ["tasks", archived ? "archived" : "active"],
    queryFn: ({ pageParam }) => listTasks({ archived, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Rows change as turns run; the list follows without a watchdog.
    refetchInterval: 15_000,
  });
}

export type TasksQuery = ReturnType<typeof useTasks>;

const SKELETON_ROWS = ["first", "second", "third"] as const;

/** Three rows of the row's own shape: the status, title and stage columns, so nothing shifts when the rows arrive. */
function SkeletonRows() {
  return (
    <ul aria-hidden="true" className="py-2">
      {SKELETON_ROWS.map((row) => (
        <li key={row} className="flex h-16 items-center gap-4 px-5">
          <span className="hidden w-32 shrink-0 md:block">
            <Skeleton className="h-3 w-20" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </span>
          <span className="flex w-8 shrink-0 justify-end md:w-32">
            <Skeleton className="h-3 w-12" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TaskList({ query, archived }: { query: TasksQuery; archived: boolean }) {
  const client = useQueryClient();
  const archive = useMutation({
    mutationFn: (task: Task) => patchTask(task.id, { archived: !task.archived }),
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (query.isPending) return <SkeletonRows />;

  if (query.isError) {
    const code = query.error instanceof ApiError ? query.error.code : "network_error";
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          Couldn't load tasks. <span className="font-mono text-xs">{code}</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      </div>
    );
  }

  const tasks = query.data.pages.flatMap((page) => page.tasks);
  if (tasks.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-surface text-muted-foreground"
        >
          <Inbox className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          {archived ? "Nothing archived." : "No tasks yet. Describe one above to start."}
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="py-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onArchive={(target) => archive.mutate(target)}
            archiving={archive.isPending && archive.variables?.id === task.id}
          />
        ))}
      </ul>
      {query.isFetchingNextPage ? (
        <SkeletonRows />
      ) : (
        <div className="flex h-14 items-center justify-center">
          {query.hasNextPage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void query.fetchNextPage()}>
              Load more
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">That's every task</p>
          )}
        </div>
      )}
    </>
  );
}
