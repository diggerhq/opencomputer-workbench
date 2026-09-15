import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Composer } from "@/components/Composer";
import { TaskList, useTasks } from "@/components/TaskList";
import { cn } from "@/lib/utils";
import { workspaceQuery } from "./__root";

export const Route = createFileRoute("/")({
  component: TasksPage,
});

type Filter = "active" | "archived";

// The list is the root: the composer, then one panel holding the filter
// tabs, the rows and the page loader, one column.
function TasksPage() {
  const workspace = useQuery(workspaceQuery).data ?? undefined;
  const client = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("active");
  const query = useTasks(filter === "archived");
  const loaded = query.data?.pages.reduce((count, page) => count + page.tasks.length, 0) ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col pt-6 pb-16">
      <h1 className="sr-only">Tasks</h1>
      <Composer
        workspace={workspace}
        onCreated={(task) => {
          void client.invalidateQueries({ queryKey: ["tasks"] });
          void navigate({ to: "/tasks/$id", params: { id: task.id } });
        }}
      />
      <section aria-label="Tasks" className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <nav
          aria-label="Filter"
          className="flex h-control items-center gap-1 border-b border-border bg-surface px-2 md:px-3"
        >
          {(["active", "archived"] as const).map((entry) => {
            const selected = filter === entry;
            return (
              <button
                key={entry}
                type="button"
                aria-pressed={selected}
                title={selected ? `${String(loaded)} loaded` : undefined}
                onClick={() => setFilter(entry)}
                className={cn(
                  "h-control-sm rounded-md px-2.5 text-sm font-medium",
                  selected
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                {entry === "active" ? `Active${query.isSuccess ? ` (${String(loaded)})` : ""}` : "Archived"}
              </button>
            );
          })}
        </nav>
        <TaskList query={query} archived={filter === "archived"} />
      </section>
    </main>
  );
}
