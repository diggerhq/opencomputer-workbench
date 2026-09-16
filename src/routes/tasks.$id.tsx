import { createFileRoute } from "@tanstack/react-router";
import { TaskPage } from "@/components/TaskPage";

export const Route = createFileRoute("/tasks/$id")({
  // The screen renders in the browser only; the server sends the shell.
  ssr: false,
  component: () => <TaskPage id={Route.useParams().id} />,
});
