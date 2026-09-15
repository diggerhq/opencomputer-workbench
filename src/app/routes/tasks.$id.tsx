import { createFileRoute } from "@tanstack/react-router";
import { TaskPage } from "@/components/TaskPage";

export const Route = createFileRoute("/tasks/$id")({
  component: () => <TaskPage id={Route.useParams().id} />,
});
