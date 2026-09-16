# Event-log fixtures

Each file is one session's event log as `GET /sessions/<id>/events` returns
it: a JSON array of `{ id, seq, timestamp, sessionId, turnId?, type, data }`
in `seq` order. The reducer (`src/app/reducer.ts`) and the task page's
components are tested over them, so every state renders without a live run.

**These logs are authored, not recorded.** They were written to
`docs/agents/events.mdx` on `opencomputer` main and to the C1 seam's
`tool.completed.data.result: true` at the pinned design revision
[1c07584](https://github.com/diggerhq/serverless-agents-ws/commit/1c07584),
with the shell tool's output shape assumed as `{ stdout, stderr, exitCode,
durationMs, timedOut? }`. They must be replaced by recordings of the
workbench's own agent on Development once W4 runs it, and the shape
assumptions checked against those recordings. Until then a difference
between a fixture and the platform is a fixture bug, never a reason to
change the platform.

| File | Scenario |
| --- | --- |
| `created-only.json` | A session that exists and has no turn |
| `working.json` | A running first turn: clone, install, a lint that exited 1, a test run in flight, a streaming reply |
| `completed.json` | The first turn reports at the published stage and completes; a second turn is queued |
| `turn-failed-runtime-lost.json` | The runtime is lost under a running command; the turn fails with `runtime_lost` |
| `cancelled.json` | A stop during a long command; the next turn runs and completes |
| `tool-timed-out.json` | A command hits the limit inside a turn that continues to a completed report |
| `tool-failed.json` | The report tool rejects a claim; the agent reports again and the turn continues |
| `ended.json` | A completed turn, then the owner ended the session |

`design/screens.md` names these under `events/`; they live here under
`fixtures/logs/` beside the row fixtures the list uses.

Reconciled on 2026-09-16 with the events page as the OC integration branch documents it: the first `message.received` of a task carries the `payload` the app sends; a call still open when its turn ends is settled by a `tool.failed` with `settledBy` ahead of the terminal turn event; `turn.cancelled` carries `settledAfterMs`, `operationsSettled` and `computerTerminated`.
