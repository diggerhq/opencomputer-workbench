import { Archive, ArchiveRestore, CircleX, Square } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ControlsProps {
  /** A turn is admitted and not yet settled by the log. */
  readonly isRunning: boolean;
  /** The running turn's id, when the log shows one; a stop is remembered against it. */
  readonly activeTurnId?: string;
  readonly ended: boolean;
  readonly archived: boolean;
  readonly onStop: () => Promise<void>;
  /** Absent until the tasks stream wires the label; the button keeps its place, disabled. */
  readonly onArchive?: () => void;
  readonly onEnd?: () => void;
}

/** Stop, Archive and End. Every control keeps its place when disabled; End confirms in a dialog. */
export function Controls({ isRunning, activeTurnId, ended, archived, onStop, onArchive, onEnd }: ControlsProps) {
  const [stopRequestedFor, setStopRequestedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!isRunning) setStopRequestedFor(null);
  }, [isRunning]);
  const key = activeTurnId ?? "pending";
  const stopping = isRunning && stopRequestedFor === key;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!isRunning || stopping || ended}
        onClick={() => {
          setStopRequestedFor(key);
          void onStop();
        }}
      >
        <Square data-icon="inline-start" />
        {stopping ? "Stopping…" : "Stop"}
      </Button>
      <Button type="button" variant="outline" disabled={!onArchive} onClick={onArchive}>
        {archived ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
        {archived ? "Unarchive" : "Archive"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={ended || !onEnd}
            className="text-destructive hover:text-destructive"
          >
            <CircleX data-icon="inline-start" />
            End
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Queued work is cancelled and the conversation becomes read-only. The branch and the pull request stay on
              GitHub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onEnd}>End</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
