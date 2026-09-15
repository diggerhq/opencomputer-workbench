import { Button } from "@/components/ui/button";
import { GitHubMark } from "./GitHubMark";
import { Wordmark } from "./Wordmark";

const REASONS: Record<string, string> = {
  not_a_member: "Your GitHub account is not a member of this workspace.",
  access_denied: "GitHub sign-in was cancelled.",
  invalid_state: "The sign-in did not complete. Try again.",
  exchange_failed: "GitHub did not complete the sign-in. Try again.",
};

export function SignIn({ reason }: { reason?: string }) {
  const message = reason ? REASONS[reason] : undefined;
  return (
    <main className="flex min-h-dvh items-center justify-center px-gutter py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-card">
        <Wordmark />
        <h1 className="mt-8 text-xl font-semibold tracking-tight">Sign in to the workbench</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Hand a repository task to an agent, leave, and come back to a tested branch and a draft pull request.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <a href="/auth/login">
            <GitHubMark className="size-4" />
            Sign in with GitHub
          </a>
        </Button>
        {message ? (
          <p role="alert" className="mt-4 rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
            {message}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">
          Access is by membership of the workspace's GitHub organization or team. Sign-in asks only to read that
          membership.
        </p>
      </div>
    </main>
  );
}
