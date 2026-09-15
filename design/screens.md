# The two screens

The workbench has a task list and a task page, no sidebar, no panels. Both
are designed here at 390 and 1440 pixels before any component exists, in the
tokens of [`tokens.css`](tokens.css) and the words of
[`src/app/vocabulary.ts`](../src/app/vocabulary.ts). The static mockups under
[`mockups/`](mockups/) render this specification; their captures under
[`screens/`](screens/) are the reference the first components are reviewed
against with the [review checklist](review-checklist.md).

Every measure below names a token. A value that is not a token does not go
into a component.

## Shared rules

- **Grid.** 8 px grid (`--space-2`), 4 px half-step for text-internal
  spacing only. Side gutter `--gutter` (16 px) below 768 px, `--gutter-wide`
  (32 px) from 768 px. Content is centered with a maximum of `--content-max`
  (960 px) on the list and `--page-max` (1280 px) on the task page.
- **Type.** Inter everywhere; Geist Mono only for commands, output, commit
  SHAs and branch names. The scale is `--text-xs` through `--text-xl`; body
  is `--text-base` (14 px). Weights: regular for prose, medium for titles and
  labels, semibold for the page heading only.
- **Rows and controls.** A task row is exactly `--row-height` (56 px)
  whatever it holds; a timeline entry is `--row-height-compact` (48 px)
  collapsed. Controls are `--control-height` (36 px), row-level controls
  `--control-height-sm` (28 px). Space for a control only some rows have is
  reserved on every row.
- **Status.** A badge is the dot (`--dot`, 8 px) and the label in the tone's
  text color on the tone's background, `--radius-full`, `--text-xs` medium,
  padding `--space-1` by `--space-2`. In a row the badge shows only the dot
  and the label without background; on the task page it shows both. The
  working dot pulses (`--pulse-duration`); no other dot moves; Archived and
  Ended show no dot.
- **Timestamps.** Relative ("4 min ago", "yesterday") in `--muted-foreground`
  with the absolute ISO time in the hover title.
- **Motion.** Streaming text shows a caret (`--caret-duration`); the working
  dot pulses. Nothing else animates, and `prefers-reduced-motion` stops both.
- **Panels.** A region renders once its data is known: the list shows
  skeleton rows of `--row-height` while loading and never a partial row; the
  result card is absent until the task has loaded, then present with its
  stage, never a spinner inside a card.
- **Tool output.** Collapsed by default behind an expander that states the
  line count ("142 lines"); expanded output is monospace on `--code`,
  wrapped, never cut without a visible "…and 3,400 more lines" line and a
  control that shows the rest.
- **Focus.** Every focusable element shows the ring: `--ring-width` of
  `--ring` at `--ring-offset`.
- **Theme.** Light on `:root`, dark under `.dark` from `next-themes` with the
  system default; both themes use the same token names.

## Task list

One column. From top: the header, the composer, the filter line, the rows,
the page loader.

### At 1440

```text
┌──────────────────────────────────────────────────────────────────────┐ 32 gutter
│  Workbench                                    team/serverless  ○ jd  │ header 56
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ [acme/service          ▾]  [main            ]                  │  │ composer
│  │ ┌────────────────────────────────────────────────────────────┐ │  │
│  │ │ Describe the task…                                         │ │  │ textarea 3 lines
│  │ └────────────────────────────────────────────────────────────┘ │  │
│  │                                             [Start task]       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  Active (12)   Archived                                              │ filter 36
│  ● Working, 2 queued  Rename the billing module  acme/service · main │ row 56
│                       J jd · 4 min ago                     changes ⌂ │
│  ● Ready for review   Add rate limiting to /api  acme/service · v2.1 │
│                       M mo · 1 h ago                     published ⌂ │
│ ▌● Failed             Fix flaky checkout test    acme/web · main     │ attention
│                       J jd · yesterday                             ⌂ │
│  …                                                                   │
│                        Load more                                     │ loader 56
└──────────────────────────────────────────────────────────────────────┘
```

- **Header.** `--row-height` tall, `--text-xl` semibold "Workbench" left;
  the membership rule's display name and the actor's avatar (`--avatar`)
  right. No navigation: the list is the root.
- **Composer.** A card (`--card`, `--border`, `--radius-lg`, padding
  `--space-4`). Row one: the repository picker and the base ref input side by
  side, each `--control-height`, the picker taking 2/3. Row two: the request
  textarea, three lines at `--text-base`, growing to eight. Row three: the
  "Start task" button right-aligned, primary. The picker is a shadcn Select
  listing the permitted repositories with their default branch as the ref
  placeholder; the ref input takes a branch, tag or commit. Disabled until
  the workspace bootstrap has answered; the button is disabled while the
  request is empty and while a submission is in flight, and reads
  "Starting…" then.
- **Filter line.** Two text tabs, "Active (n)" and "Archived", `--text-sm`
  medium, the active one in `--foreground` with a 2 px underline in
  `--accent`, the other in `--muted-foreground`. The count comes from the
  loaded rows and says so on hover ("12 loaded").
- **Row.** `--row-height`, bottom border `--border`, three columns on a
  fixed template: status 176 px, title and actor flexible, result stage and
  archive 128 px, `--space-4` between them. Line one: the badge (dot and
  label) in the first column; the title at `--text-base` medium, ellipsized
  at one line, with the repository and ref at `--text-sm` mono in
  `--muted-foreground` right of it. Line two, under the title: the actor's
  avatar (16 px) and login, then the relative age, at `--text-xs` in
  `--muted-foreground`. The third column, vertically centered across both
  lines: the result stage word ("base", "changes", "published") at
  `--text-xs` when present, then the archive control (`--control-height-sm`,
  icon button, lucide `archive`, or `archive-restore` on an archived row)
  which exists on every row and is visible on hover and focus. A Working row
  with queued turns reads "Working, 2 queued". A row that needs attention
  (failed, not started, or idle with an unanswered final message) carries a
  3 px left border in `--attention`. The whole row is a link to the task
  page; the archive control stops propagation.
- **Page loader.** A `--row-height` row holding a secondary "Load more"
  button while `nextCursor` is present; a `--text-sm` muted "That's every
  task" line when it is null; three skeleton rows while a page loads.

### At 390

Same order, one column, gutter `--gutter`. The header keeps the title and
the avatar; the display name moves to the avatar's hover. The composer
stacks: picker, ref, textarea, button full width. The row keeps its
`--row-height` on a three-column template (status auto, title flexible,
archive `--control-height-sm`): line one is the badge and the title; the
result stage folds into the badge as a muted word after the label ("Ready
for review · published"); line two spans the first two columns with the
actor, the repository and ref in mono, and the age at `--text-xs`; the
archive control stays reserved at the right edge, centered across both
lines, and is always visible, since there is no hover.

## Task page

Three regions: the request and the result card; the activity timeline; the
conversation with the follow-up composer and the controls. One column below
1024 px; from 1024 px the first and third regions share the left column and
the timeline takes the right.

### At 1440

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ← Tasks                                                     ○ jd    │ header 56
│  Rename the billing module                        ● Working, 2 queued│ title row
│  acme/service at main · jd · started 4 min ago · task 01J9…          │ meta
├──────────────────────────────┬───────────────────────────────────────┤
│ Request                      │ Activity                              │
│ ┌──────────────────────────┐ │ ── Turn 1 · 4 min ago ─────────────── │
│ │ Rename `billing` to      │ │ ▸ shell  git clone …          142 lines│ entry 48
│ │ `invoicing` across the   │ │ ▸ shell  npm test               ✓ 3.2s│
│ │ service, keep the public │ │ ▾ shell  npm run lint           ✗ 1.1s│ expanded
│ │ API stable…              │ │   ┌──────────────────────────────┐    │
│ └──────────────────────────┘ │   │ src/billing/index.ts:12:3    │    │ code
│                              │   │   error  unused import       │    │
│ Result  reported by turn 2   │   └──────────────────────────────┘    │
│ ┌──────────────────────────┐ │ ▸ report                       ✓      │
│ │ published                │ │ ── Turn 2 · 1 min ago ─────────────── │
│ │ base   a1b2c3d  main     │ │ ● shell  npm test                     │ running
│ │ branch task/01J9…        │ │                                       │
│ │ commit d4e5f6a           │ │                                       │
│ │ PR     #482 draft ↗      │ │                                       │
│ │ checks npm test ✓ 41 passed (reported)                             │
│ │        Compare a1b2c3d…d4e5f6a ↗                                   │
│ └──────────────────────────┘ │                                       │
│                              │                                       │
│ Conversation                 │                                       │
│  jd  Rename `billing`…       │                                       │
│  agent  I cloned the repo…   │                                       │
│  jd  Also update the README  │                                       │
│  agent  Working on it▌       │                                       │
│ ┌──────────────────────────┐ │                                       │
│ │ Follow up…               │ │                                       │
│ └──────────────────────────┘ │                                       │
│ [Send]      [Stop] [Archive] [End]                                   │ controls
└──────────────────────────────┴───────────────────────────────────────┘
```

- **Header.** "← Tasks" link left, avatar right, `--row-height`.
- **Title row.** The title at `--text-lg` medium (the first line of the
  request, editable on click as the `title` label), the full badge right.
  Below at `--text-sm` in `--muted-foreground`: repository and ref (mono),
  actor, started age, the task id (mono, truncated, full id on hover), and
  "continues <predecessor title>" as a link when set.
- **Columns.** From 1024 px: left 5/12, right 7/12, gap `--space-8`. The
  left column is the request, then the result card, then the conversation;
  the right column is the timeline, sticky to the viewport with its own
  scroll so a long timeline never pushes the conversation off screen.
- **Request.** A card with the request text at `--text-md`, rendered as
  Markdown, the label "Request" above at `--text-xs` medium uppercase in
  `--muted-foreground`.
- **Result card.** Label "Result" with "reported by turn n" right of it.
  The stage as the card's first line in the ready tone's text color at
  `--text-sm` medium ("base", "changes", "published"), or, when the result
  came from an earlier turn than the last settled one, "Finished, no new
  changes reported · result from turn n" in `--muted-foreground`. Then a
  definition list, `--text-sm`, keys at `--muted-foreground` in a 72 px
  column: base (SHA mono, ref), branch (mono), commit (SHA mono), PR
  (number, "draft" when so, external link), checks (each command mono with
  ✓ or ✗ and the summary, suffixed "(reported)" because it is the agent's
  claim), and the compare link from base to commit. Absent fields are absent
  rows, not dashes; the card is not shown at all when there is no result,
  and in its place a `--text-sm` muted line says "No result reported yet".
- **Timeline.** Label "Activity". Turn boundaries are `--text-xs` medium
  rules "Turn n · age" with a leading dot in the turn's outcome tone
  (completed neutral, failed red, cancelled amber, running working). Each
  tool call is a `--row-height-compact` entry: an expander chevron, the
  tool name at `--text-sm` medium, the title or command at `--text-sm` mono
  ellipsized, and on the right the outcome (✓ or ✗ with the duration, a
  pulsing dot while running, "timed out" in the failed tone when the
  command hit its limit). Expanded, the output block follows: `--code`
  background, `--code-foreground`, `--text-sm` mono, wrapped, `--radius-md`,
  padding `--space-3`, at most 40 lines then the "…and n more lines" line
  with "Show all". A `report` call shows its input as the definition list
  the result card uses. Message deltas are not in the timeline; they are the
  conversation.
- **Conversation.** Label "Conversation". Messages alternate: the actor's
  login as the speaker for user turns, "agent" for the assistant, `--text-xs`
  medium in `--muted-foreground` above `--text-base` prose; the assistant's
  Markdown rendered; a streaming message ends with the caret. A failed turn
  renders the failure copy in the failed tone as a message-shaped block
  with the code in mono after it; a cancelled turn a muted "Stopped" line.
  Then the follow-up composer: a textarea of two lines growing to six and a
  primary "Send" button; disabled and explained ("This task has ended")
  when the session is ended.
- **Controls.** One row, `--control-height`: "Send" left; "Stop" (secondary,
  enabled while working or queued, reads "Stopping…" disabled while the
  stop settles), "Archive" / "Unarchive" (secondary), "End" (destructive
  outline, opens a confirm dialog: "End this task? Queued work is cancelled
  and the conversation becomes read-only.") right. Every control keeps its
  place when disabled.

### At 390

One column: header, title row (badge below the title, meta wrapping), the
request, the result card, the timeline, the conversation, the composer, the
controls. The timeline is not sticky. Tool entries keep `--row-height-compact`
with the command on its own second line if it does not fit; the outcome stays
on line one. Controls wrap to two rows of full-width buttons: Send alone,
then Stop, Archive, End in thirds.

## States

Every state has a fixture that renders it without a live run. Fixture names
are fixed here; W2 records the rows and W3 the event logs into `fixtures/`.

| Component | State | Shows | Fixture |
| --- | --- | --- | --- |
| TaskList | loading | Three skeleton rows of `--row-height`, no text | (none: rendered before data) |
| TaskList | empty | "No tasks yet. Describe one above to start." in `--muted-foreground`, centered in a `--space-16` tall box | `rows/empty.json` |
| TaskList | empty, archived filter | "Nothing archived." | `rows/empty.json` |
| TaskList | page | Rows, then "Load more" while `nextCursor` | `rows/page-1.json`, `rows/page-2.json` |
| TaskList | last page | Rows, then "That's every task" | `rows/page-last.json` |
| TaskList | error | "Couldn't load tasks." with the error code in mono and a "Retry" button, in place of the rows | `rows/error.json` |
| TaskRow | starting | Neutral dot, "Starting" | `rows/starting.json` |
| TaskRow | not started | Amber dot, "Not started", attention border | `rows/not-started.json` |
| TaskRow | queued | Neutral dot, "Queued" | `rows/queued.json` |
| TaskRow | working | Pulsing dot, "Working" or "Working, n queued" | `rows/working.json`, `rows/working-queued.json` |
| TaskRow | stopping | Amber dot, "Stopping" | `rows/stopping.json` |
| TaskRow | idle | Neutral dot, "Idle"; result stage when the result is older than the last turn | `rows/idle.json`, `rows/idle-old-result.json` |
| TaskRow | ready for review | Green dot, "Ready for review", stage "changes" or "published" | `rows/ready-changes.json`, `rows/ready-published.json` |
| TaskRow | failed | Red dot, "Failed", attention border | `rows/failed.json` |
| TaskRow | archived | No dot, "Archived", muted title | `rows/archived.json` |
| TaskRow | ended | No dot, "Ended" | `rows/ended.json` |
| Composer | idle | Picker, ref, empty textarea, disabled button | `workspace/ready.json`, `repos/two.json` |
| Composer | bootstrapping | Every control disabled, no text change | (rendered before `workspace` answers) |
| Composer | submitting | Button "Starting…" disabled, fields read-only | (interaction) |
| Composer | conflict | Inline problem above the button: "A task with this id already exists with a different request. Keep editing or start over." Draft kept | `problems/idempotency-conflict.json` |
| Composer | refused | Inline problem from `failureCopy` (for example insufficient credits). Draft kept | `problems/insufficient-credits.json` |
| Composer | no repositories | Picker disabled with "No repositories are connected" | `repos/none.json` |
| StatusBadge | each state | The dot rule and the label from `DISPLAY` | (derived from the row fixtures) |
| ActivityTimeline | loading | Three `--row-height-compact` skeleton entries | (rendered while replaying) |
| ActivityTimeline | empty | "Nothing has run yet." | `events/created-only.json` |
| ActivityTimeline | streaming | A running entry with the pulsing dot, earlier entries settled | `events/working.json` |
| ActivityTimeline | error | Failed turn rule in the failed tone; entries before it intact | `events/turn-failed-runtime-lost.json` |
| ActivityTimeline | terminal | Every turn settled, the last rule completed or cancelled | `events/completed.json`, `events/cancelled.json` |
| ToolCall | running | Chevron, name, command, pulsing dot | `events/working.json` |
| ToolCall | succeeded, collapsed | ✓ and duration, "n lines" on the chevron | `events/completed.json` |
| ToolCall | succeeded, expanded | The output block | (interaction on `events/completed.json`) |
| ToolCall | failed | ✗, the tool's message in the failed tone; the turn continues | `events/tool-failed.json` |
| ToolCall | timed out | "timed out after 120 s" in the failed tone; the turn continues | `events/tool-timed-out.json` |
| ToolCall | report | The definition list of the reported fields | `events/completed.json` |
| ResultCard | none | "No result reported yet" line, no card | `rows/idle.json` |
| ResultCard | base | Stage "base", one row | `rows/result-base.json` |
| ResultCard | changes | Stage "changes", base, branch, commit, checks, compare link | `rows/ready-changes.json` |
| ResultCard | published | Stage "published", plus the PR row | `rows/ready-published.json` |
| ResultCard | older turn | "Finished, no new changes reported · result from turn n" | `rows/idle-old-result.json` |
| Conversation | replaying | "Loading the conversation…" | (rendered while replaying) |
| Conversation | streaming | The last assistant message with the caret | `events/working.json` |
| Conversation | failed turn | The failure copy block with the code | `events/turn-failed-runtime-lost.json` |
| Conversation | stopped turn | The "Stopped" line | `events/cancelled.json` |
| Conversation | ended | Composer disabled, "This task has ended" | `events/ended.json` |
| Conversation | send rejected | Toast with the `SendError` message; draft kept | (interaction) |
| Controls | working | Stop enabled, Archive enabled, End enabled | `rows/working.json` |
| Controls | stopping | Stop reads "Stopping…" disabled | `rows/stopping.json` |
| Controls | idle | Stop disabled | `rows/idle.json` |
| Controls | ended | Stop disabled, Archive enabled, End disabled | `rows/ended.json` |
| Controls | end confirm | The dialog | (interaction) |

## Failure copy

The public failure codes the API edge emits on a turn, and the admission
refusals the composer can receive, each with the sentence the user reads.
`failureCopy` in `src/app/vocabulary.ts` is the one source; unknown codes
are shown as "The turn failed with code <code>."

| Code | Where | Copy |
| --- | --- | --- |
| `runtime_lost` | turn | The agent's runtime stopped responding and this turn was abandoned. Send a follow-up to continue; it may need a fresh computer. |
| `runtime_failed` | turn | The agent's runtime failed before the turn finished. Send a follow-up to continue. |
| `sandbox_failed` | turn | The task's computer could not run this turn. Send a follow-up to continue; it may need a fresh computer. |
| `model_rejected` | turn | The model provider rejected the request. Check the account's credentials, rate limit or quota, then send a follow-up. |
| `insufficient_credits` | admission | The workspace is out of credits. Add credits before starting or continuing a task. |
| `context_too_long` | turn | This conversation exceeds the model's context window. Start a fresh task and name this one as its predecessor. |
| `interrupted` | turn | The turn was stopped before it finished. |
| `session_ended` | turn | The session ended while the turn ran. |

A timed-out or non-zero command is not in this table: it is a tool error
inside a running turn and is rendered in the timeline entry, never as the
task's failure.
