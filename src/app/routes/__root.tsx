import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SignIn } from "@/components/SignIn";
import { Button } from "@/components/ui/button";
import { fetchWorkspace, signOut, type Workspace } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export const workspaceQuery = { queryKey: ["workspace"], queryFn: fetchWorkspace } as const;

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <Gate />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  ),
});

function Gate() {
  const workspace = useQuery(workspaceQuery);
  if (workspace.isPending) {
    return <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }
  if (workspace.isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 text-center text-sm text-destructive">
        <p role="alert">{workspace.error.message}</p>
      </main>
    );
  }
  if (!workspace.data) {
    return <SignIn reason={new URLSearchParams(window.location.search).get("error") ?? undefined} />;
  }
  return <Shell workspace={workspace.data} />;
}

function Shell({ workspace }: { workspace: Workspace }) {
  const client = useQueryClient();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4">
      <header className="flex h-14 items-center justify-between gap-4 border-b">
        <Link to="/" className="font-semibold tracking-tight">
          Workbench
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">
            {workspace.membership.display} · {workspace.environment}
          </span>
          <span className="flex items-center gap-2">
            {workspace.identity.avatarUrl ? (
              <img src={workspace.identity.avatarUrl} alt="" width={24} height={24} className="size-6 rounded-full" />
            ) : null}
            {workspace.identity.login}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void signOut().finally(() => client.invalidateQueries({ queryKey: workspaceQuery.queryKey }));
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
