// The actor's GitHub avatar at meta-line size, or the same circle empty
// when there is no actor id. One size everywhere an actor appears: rows,
// the task header and the conversation.
import { cn } from "@/lib/utils";

export function ActorAvatar({ id, className }: { id?: number; className?: string }) {
  const classes = cn("size-5 shrink-0 rounded-full border bg-muted", className);
  if (!id) return <span aria-hidden="true" className={classes} />;
  return (
    <img
      src={`https://avatars.githubusercontent.com/u/${String(id)}?s=40`}
      alt=""
      width={20}
      height={20}
      className={classes}
    />
  );
}
