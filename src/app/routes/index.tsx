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

// The list is the root: the composer, the two filter tabs, the rows and the
// page loader, one column.
function TasksPage() {
  const workspace = useQuery(workspaceQuery).data ?? undefined;
  const client = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("active");
  const query = useTasks(filter === "archived");
  const loaded = query.data?.pages.reduce((count, page) => count + page.tasks.length, 0) ?? 0;

  return (
    <main className="flex flex-1 flex-col pb-12">
      <div className="pt-4">
        <Composer
          workspace={workspace}
          onCreated={(task) => {
            void client.invalidateQueries({ queryKey: ["tasks"] });
            void navigate({ to: "/tasks/$id", params: { id: task.id } });
          }}
        />
      </div>
      <nav aria-label="Filter" className="mt-6 flex h-control items-end gap-6 border-b border-border">
        {(["active", "archived"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={filter === entry}
            title={filter === entry ? `${String(loaded)} loaded` : undefined}
            onClick={() => setFilter(entry)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-medium",
              filter === entry ? "border-accent text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {entry === "active" ? `Active${query.isSuccess ? ` (${String(loaded)})` : ""}` : "Archived"}
          </button>
        ))}
      </nav>
      <TaskList query={query} archived={filter === "archived"} />
    </main>
  );
}
