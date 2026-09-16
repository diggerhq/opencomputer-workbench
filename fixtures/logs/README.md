# Event-log fixtures

Each file is one session's event log as `GET /sessions/<id>/events` returns
it: a JSON array of `{ id, seq, timestamp, sessionId, turnId?, type, data }`
in `seq` order. The reducer (`src/app/reducer.ts`) and the task page's
components are tested over them, so every state renders without a live run.

**`recorded/` holds recordings; the rest is authored.** `recorded/first-run.json`
is the event log of the workbench's first real task on Development
(2026-09-16, session `ca088683-e3fe-d635-09e3-a22d89b649f1`, turn
`8c28580e-7a53-4cfa-95ac-66df1e3884db`, deployment
`opencomputer-workbench:bbcbad5e2763bab93f8fe7f8dd2ec4589f31c019eda0618b19e2b9594c00153f`):
clone, checks, commit, push, a draft pull request and the report the
verifier accepted on the third call. `completed.json` is the same recording
byte for byte, so the scenario it names renders from a real log; keep the
two files identical. The other logs were written to
`docs/agents/events.mdx` on `opencomputer` main and to the C1 seam's
`tool.completed.data.result: true` at the pinned design revision
[1c07584](https://github.com/diggerhq/serverless-agents-ws/commit/1c07584)
before any recording existed; replace each with a recording of the same
scenario as one is made, and keep the shapes the recording shows.

What the recording established about shapes, applied to the app:

- A computer command (`sandbox_exec`) completes with `data.output` as one JSON
  **string** encoding `{ stdout, stderr, exitCode, signal, timedOut,
  terminated, truncated, durationMs, isolation, contained, orphansTerminated }`;
  the app parses it (`parseOutput` in `src/app/activity.ts`). The authored
  logs carry the same fields as an object; both shapes are read.
- The report tool completes with `data.output` as an object and
  `data.result: true`; a rejected call is `tool.failed` with the verifier's
  message.
- `tool.progress` carries `stage` and a `sandboxOperation` id; `message.completed`
  carries `finalText` beside `text`.

| File | Scenario |
| --- | --- |
| `created-only.json` | A session that exists and has no turn |
| `working.json` | A running first turn: clone, install, a lint that exited 1, a test run in flight, a streaming reply |
| `completed.json` | Recorded: the first real task, reporting at the published stage after two rejected reports; one turn |
| `turn-failed-runtime-lost.json` | The runtime is lost under a running command; the turn fails with `runtime_lost` |
| `cancelled.json` | A stop during a long command; the next turn runs and completes |
| `tool-timed-out.json` | A command hits the limit inside a turn that continues to a completed report |
| `tool-failed.json` | The report tool rejects a claim; the agent reports again and the turn continues |
| `ended.json` | A completed turn, then the owner ended the session |

`design/screens.md` names these under `events/`; they live here under
`fixtures/logs/` beside the row fixtures the list uses.

Reconciled on 2026-09-16 with the events page as the OC integration branch documents it: the first `message.received` of a task carries the `payload` the app sends; a call still open when its turn ends is settled by a `tool.failed` with `settledBy` ahead of the terminal turn event; `turn.cancelled` carries `settledAfterMs`, `operationsSettled` and `computerTerminated`.
