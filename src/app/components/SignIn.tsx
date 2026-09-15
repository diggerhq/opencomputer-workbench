import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const REASONS: Record<string, string> = {
  not_a_member: "Your GitHub account is not a member of this workspace.",
  access_denied: "GitHub sign-in was cancelled.",
  invalid_state: "The sign-in did not complete. Try again.",
  exchange_failed: "GitHub did not complete the sign-in. Try again.",
};

export function SignIn({ reason }: { reason?: string }) {
  const message = reason ? REASONS[reason] : undefined;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Workbench</h1>
        <p className="text-sm text-muted-foreground">
          Delegate repository tasks to an agent, leave, and come back to verified changes and a draft pull request.
        </p>
      </div>
      <Button asChild size="lg">
        <a href="/auth/login">
          <LogIn data-icon="inline-start" />
          Sign in with GitHub
        </a>
      </Button>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </main>
  );
}
