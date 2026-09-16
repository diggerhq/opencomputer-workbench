# Row fixtures

One `SessionSummary` row per state the [states table](../../design/screens.md#states)
names, and the list responses the page states use. `toTask` is unit-tested
over every one of them (`test/task.test.ts`), so each state renders without a
live run.

**These rows are AUTHORED**, not recorded: they follow the C1 seam of the
workbench design at its pinned revision `1c07584` (`labels`, `activity`,
`revision`, `result` with the report tool's data). They must be replaced by
recordings from real Development sessions once the labels, listing and typed
result contracts ship, keeping the same file names.

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
| `ready-published.json` | Idle; the last turn reported a draft pull request |
| `failed.json` | The last turn failed with `runtime_lost` |
| `archived.json` | Archived and working at the same time |
| `ended.json` | The session ended; read-only |
| `page-1.json`, `page-2.json`, `page-last.json` | List responses with and without a next cursor |
| `empty.json` | An empty list |
| `error.json` | The problem shape an upstream failure produces |

Timestamps are relative to `2026-09-15T20:45:00Z`; tests read them with a
clock one minute later.

Reconciled on 2026-09-16 with the management API as the OC integration branch documents it: `activity.lastSettledTurn` is `{ id, status, at }` and carries no failure code (the workbench's ask for `code` on failed rows is open in the build ledger), and a row's `environment` may be `null`.
