import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { LogOut, Users } from "lucide-react";
import { Toaster } from "sonner";
import { SignIn } from "@/components/SignIn";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/Wordmark";
import { fetchWorkspace, signOut, type Workspace } from "@/lib/api";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export const workspaceQuery = { queryKey: ["workspace"], queryFn: fetchWorkspace } as const;

/** The one container: the header, the list and the task page share its edges and gutters. */
export const CONTAINER = "mx-auto w-full max-w-6xl px-4 md:px-8";

export const Route = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={300}>
      <QueryClientProvider client={queryClient}>
        <Gate />
        <Toaster position="bottom-right" closeButton />
      </QueryClientProvider>
    </TooltipProvider>
  ),
});

function Gate() {
  const workspace = useQuery(workspaceQuery);
  if (workspace.isPending) {
    return <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }
  if (workspace.isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 text-center text-sm">
        <p role="alert" className="rounded-md bg-status-failed-bg px-3 py-2 text-status-failed">
          {workspace.error.message}
        </p>
      </main>
    );
  }
  if (!workspace.data) {
    return <SignIn reason={new URLSearchParams(window.location.search).get("error") ?? undefined} />;
  }
  return <Shell workspace={workspace.data} />;
}

function initials(login: string): string {
  return login.slice(0, 2).toUpperCase();
}

function Shell({ workspace }: { workspace: Workspace }) {
  const client = useQueryClient();
  const production = workspace.environment === "production";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-(--z-sticky) border-b bg-background">
        <div data-slot="header-inner" className={cn(CONTAINER, "flex h-14 items-center justify-between gap-4")}>
          <Link to="/" data-slot="brand" className="rounded-md text-base">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden font-normal text-muted-foreground sm:inline-flex"
              title={`Members of ${workspace.membership.display} share every task`}
            >
              <Users aria-hidden="true" />
              {workspace.membership.display}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "hidden font-normal sm:inline-flex",
                production ? "text-attention" : "text-muted-foreground",
              )}
              title="The OpenComputer environment this workbench uses"
            >
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", production ? "bg-attention" : "bg-status-idle-dot")}
              />
              {workspace.environment}
            </Badge>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`${workspace.identity.login}, account menu`}>
                  <Avatar size="sm">
                    {workspace.identity.avatarUrl ? <AvatarImage src={workspace.identity.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initials(workspace.identity.login)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium text-foreground">{workspace.identity.login}</span>
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {workspace.membership.display} · {workspace.environment}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut().finally(() => client.invalidateQueries({ queryKey: workspaceQuery.queryKey }));
                  }}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div className={cn(CONTAINER, "flex flex-1 flex-col")}>
        <Outlet />
      </div>
    </div>
  );
}
