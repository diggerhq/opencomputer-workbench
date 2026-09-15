import { useNow } from "@/hooks/use-now";
import { formatRelative } from "./format";

/** A relative age with the absolute time in the title, as the design fixes it. */
export function RelativeTime({ iso, prefix, className }: { iso?: string; prefix?: string; className?: string }) {
  const now = useNow();
  if (!iso) return null;
  return (
    <time dateTime={iso} title={iso} className={className}>
      {prefix ? `${prefix} ` : ""}
      {formatRelative(iso, now)}
    </time>
  );
}
