// The task page's view of a session: `useAgent` attaches through the app's
// three proxied routes and hands every event, replayed and live, to the
// reducer stopgap. The reduced activity lives in React state and resets
// when the session changes, so a page that switches tasks never shows the
// previous one's turns.
import { type AgentEvent, type UseAgentResult, useAgent } from "@opencomputer/react";
import { useCallback, useRef, useState } from "react";
import { type Activity, applyEvent, emptyActivity } from "@/reducer";

/** The prefix of the three routes the hook needs, as the app serves them. */
export const AGENT_BASE_PATH = "/api/agent";

export interface ActivityResult extends UseAgentResult {
  readonly activity: Activity;
}

export function useActivity(sessionId: string): ActivityResult {
  const [activity, setActivity] = useState<Activity>(emptyActivity);
  const current = useRef(activity);
  const [attached, setAttached] = useState(sessionId);
  if (attached !== sessionId) {
    // A different task: start from an empty log before the hook replays it.
    setAttached(sessionId);
    current.current = emptyActivity();
    setActivity(current.current);
  }
  const onEvent = useCallback((event: AgentEvent) => {
    const next = applyEvent(current.current, event);
    if (next === current.current) return;
    current.current = next;
    setActivity(next);
  }, []);
  const agent = useAgent({ sessionId, basePath: AGENT_BASE_PATH, onEvent });
  return { ...agent, activity };
}
