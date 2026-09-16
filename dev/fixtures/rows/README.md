# Row fixtures

One `SessionSummary` row per state the [states table](../../design/screens.md#states)
names, and the list responses the page states use. `toTask` is unit-tested
over every one of them (`dev/test/task.test.ts`), so each state renders without a
live run.

**`recorded/` holds recordings; the rest is authored.** `recorded/first-run.json`
is the list row of the workbench's first real task on Development
(2026-09-16, session `ca088683-e3fe-d635-09e3-a22d89b649f1`), read from the
filtered list with `label.request`; `ready-published.json` is the same row
byte for byte, so that state renders from a real row; keep the two files
identical. The other rows follow the C1 seam of the workbench design at its
pinned revision `1c07584` (`labels`, `activity`, `revision`, `result` with the
report tool's data) and are replaced by recordings of the same state as they
are made, keeping the file names. The recorded row confirmed the seam:
`activity.lastSettledTurn` is `{ id, status, at }`, `result` is
`{ turnId, callId, reportedAt, data }` with `data.repo` present, and
`environment` is set.

| File | State |
| --- | --- |
| `starting.json` | The session exists and no turn has been admitted, half a minute old |
| `not-started.json` | The same, fifteen minutes old: the request was never accepted as work |
| `queued.json` | A turn is admitted and none is running |
| `working.json` | A turn is running |
| `working-queued.json` | A turn is running with two more queued; a result from an earlier turn |
| `stopping.json` | A stop is recorded and not yet settled |
| `idle.json` | The last turn settled, nothing queued, no result |
| `idle-old-result.json` | Idle; the result was reported by an earlier turn than the last settled one |
| `result-base.json` | Idle; the agent reported only the resolved base commit |
| `ready-changes.json` | Idle; the last turn reported a tested commit on the pushed branch |
| `ready-published.json` | Recorded: idle; the last turn reported a draft pull request with a failed check |
| `failed.json` | The last turn failed with `runtime_lost` |
| `archived.json` | Archived and working at the same time |
| `ended.json` | The session ended; read-only |
| `page-1.json`, `page-2.json`, `page-last.json` | List responses with and without a next cursor |
| `empty.json` | An empty list |
| `error.json` | The problem shape an upstream failure produces |

Timestamps are relative to `2026-09-15T20:45:00Z`; tests read them with a
clock one minute later.

Reconciled on 2026-09-16 with the management API as the OC integration branch documents it: `activity.lastSettledTurn` is `{ id, status, at }` and carries no failure code (the workbench's ask for `code` on failed rows is open in the build ledger), and a row's `environment` may be `null`.
