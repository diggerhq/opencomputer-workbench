// The product's mark and name, used by the header and the sign-in screen.
import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground", className)}
    >
      <Hammer className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-medium tracking-tight", className)}>
      <Mark />
      Workbench
    </span>
  );
}
