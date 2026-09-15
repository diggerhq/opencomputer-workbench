import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Composer } from "@/components/Composer";
import { TaskList, useTasks } from "@/components/TaskList";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <main className="flex flex-1 flex-col gap-6 py-6 pb-16">
      <h1 className="sr-only">Tasks</h1>
      <Composer
        workspace={workspace}
        onCreated={(task) => {
          void client.invalidateQueries({ queryKey: ["tasks"] });
          void navigate({ to: "/tasks/$id", params: { id: task.id } });
        }}
      />
      <Card data-slot="task-list" role="region" aria-label="Tasks" className="gap-0 py-0">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="gap-0">
          <div className="flex h-12 items-center border-b bg-surface px-4">
            <TabsList variant="line" aria-label="Filter">
              <TabsTrigger value="active" title={filter === "active" ? `${String(loaded)} loaded` : undefined}>
                Active{query.isSuccess && filter === "active" ? ` (${String(loaded)})` : ""}
              </TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value={filter}>
            <TaskList query={query} archived={filter === "archived"} />
          </TabsContent>
        </Tabs>
      </Card>
    </main>
  );
}
