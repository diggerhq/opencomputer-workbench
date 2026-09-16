import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-2">
          <Wordmark className="mb-4" />
          <CardTitle className="text-xl font-medium tracking-tight">Sign in to the workbench</CardTitle>
          <CardDescription className="text-base">
            Hand a repository task to an agent, leave, and come back to a tested branch and a draft pull request.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild className="w-full">
            <a href="/auth/login">
              <GitHubMark className="size-4" />
              Sign in with GitHub
            </a>
          </Button>
          {message ? (
            <p role="alert" className="rounded-md bg-status-failed-bg px-3 py-2 text-sm text-status-failed">
              {message}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Access is by membership of the workspace's GitHub organization or team. Sign-in asks only to read that
            membership.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
