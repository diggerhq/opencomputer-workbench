// The list: one OpenComputer call per page, rows mapped on the server, the
// cursor passed through. Loading shows skeleton rows of the row height and
// never a partial row; an error replaces the rows with the code and a retry;
// the last page says so.
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

function SkeletonRows() {
  return (
    <ul aria-hidden="true">
      {SKELETON_ROWS.map((row) => (
        <li
          key={row}
          className="grid h-row grid-cols-[auto_minmax(0,1fr)_--spacing(7)] items-center gap-x-3 border-b border-border md:grid-cols-[--spacing(44)_minmax(0,1fr)_--spacing(32)] md:gap-x-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-12 justify-self-end" />
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
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          Couldn't load tasks. <span className="font-mono">{code}</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const tasks = query.data.pages.flatMap((page) => page.tasks);
  if (tasks.length === 0) {
    return (
      <p className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
        {archived ? "Nothing archived." : "No tasks yet. Describe one above to start."}
      </p>
    );
  }

  return (
    <>
      <ul>
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
        <div className="flex h-row items-center justify-center">
          {query.hasNextPage ? (
            <Button type="button" variant="outline" onClick={() => void query.fetchNextPage()}>
              Load more
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">That's every task</p>
          )}
        </div>
      )}
    </>
  );
}
