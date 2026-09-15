import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: TaskList,
});

// The task list arrives with the tasks stream; until then the page is an
// honest empty state, not a mock.
function TaskList() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
      <h2 className="text-lg font-medium">No tasks yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">Tasks you delegate to the agent will be listed here.</p>
    </main>
  );
}
