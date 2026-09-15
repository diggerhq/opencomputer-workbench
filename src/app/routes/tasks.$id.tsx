import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks/$id")({
  component: TaskPage,
});

// The task page arrives with the task-page stream; this shell only names the
// task and links back.
function TaskPage() {
  const { id } = Route.useParams();
  return (
    <main className="flex flex-1 flex-col gap-4 py-8">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← All tasks
      </Link>
      <h2 className="font-mono text-sm text-muted-foreground">Task {id}</h2>
      <p className="text-sm text-muted-foreground">This task page is not built yet.</p>
    </main>
  );
}
