// The task page's view of a session: `useAgent` attaches through the app's
// three proxied routes and reduces the log into messages and turns; every
// event it applies, replayed and live, also reaches `noteEvent` for the
// timestamps, messages and settlement the turns do not carry. The notes live
// in React state and reset when the session changes, so a page that switches
// tasks never shows the previous one's turns.
import { type AgentEvent, type UseAgentResult, useAgent } from "@opencomputer/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { type Activity, activityOf, emptyNotes, type Notes, noteEvent } from "@/lib/activity";

/** The prefix of the three routes the hook needs, as the app serves them. */
export const AGENT_BASE_PATH = "/api/agent";

export interface ActivityResult extends UseAgentResult {
  readonly activity: Activity;
}

export function useActivity(sessionId: string): ActivityResult {
  const [notes, setNotes] = useState<Notes>(emptyNotes);
  const current = useRef(notes);
  const [attached, setAttached] = useState(sessionId);
  if (attached !== sessionId) {
    // A different task: start from an empty log before the hook replays it.
    setAttached(sessionId);
    current.current = emptyNotes();
    setNotes(current.current);
  }
  const onEvent = useCallback((event: AgentEvent) => {
    const next = noteEvent(current.current, event);
    if (next === current.current) return;
    current.current = next;
    setNotes(next);
  }, []);
  const agent = useAgent({ sessionId, basePath: AGENT_BASE_PATH, onEvent });
  const activity = useMemo(() => activityOf(agent.turns, notes), [agent.turns, notes]);
  return { ...agent, activity };
}
