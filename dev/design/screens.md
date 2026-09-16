# The two screens

The workbench has a task list and a task page, no sidebar, no panels. Both
are designed here at 390 and 1440 pixels before any component exists, in the
tokens of [`tokens.css`](tokens.css) and the words of
[`src/app/vocabulary.ts`](../src/app/vocabulary.ts). The static mockups under
[`mockups/`](mockups/) were the first rendering of this specification; the
screenshot suite (`dev/e2e/screens.spec.ts`) now captures the application itself
into [`screens/app/`](screens/app/) from the recordings under `dev/fixtures/`,
and those captures are what every UI change is reviewed against with the
[review checklist](review-checklist.md). Where building the screens changed
the specification, the [last section](#what-the-built-screens-changed) says
what and why.

Every measure below names a token or a step of Tailwind's 4 px scale, and
every control size is one of shadcn's (default `h-8`, small `h-7`, extra
small `h-6`). A value that is neither does not go into a component;
`dev/e2e/measure.spec.ts` reads the rendered page and fails when one does.

## Shared rules

- **Grid and rhythm.** Tailwind's 4 px scale, one system with the shadcn
  primitives, in three deliberate steps so tight and generous intervals read
  as a cadence: `gap-2` (8 px) within a control group or between a title and
  its meta line, `gap-3` (12 px) between a heading and the panel it names,
  `gap-4` (16 px) between groups inside a card, `gap-8` to `gap-10` (32 to
  40 px) between sections of a page. A card's inset is `p-5` (20 px); rows
  inside the list panel share it (`px-5`). Pages start `pt-8` (32 px) under
  the header. Side gutter `px-4` (16 px) below 768 px, `px-8` (32 px) from
  768 px. One container, `max-w-6xl` (1152 px), shared by the header, the
  list and the task page, so their left edges coincide.
- **Type.** Inter everywhere; Geist Mono only for commands, output, commit
  SHAs and branch names. The scale is `--text-xs` through `--text-xl`; body
  is `--text-base` (14 px). Two weights: regular for everything, medium for
  the one emphasis in each context (a row's title, the page title, a panel's
  name, the selected tab, "Turn n", a button). Status labels, section
  headings, speakers, tool names, keycaps and chips are regular; a heading
  outside a card is `--text-sm` medium in `--muted-foreground` so it names
  the section without competing with it. Semibold is not used.
- **Rows and controls.** A task row is exactly `h-16` (64 px) whatever it
  holds, with no divider between rows: the title-and-meta cadence and the
  hover tint separate them. A timeline entry is `h-8` (32 px) collapsed. Controls are shadcn's
  default `h-8` (32 px), row-level controls `size="sm"` (28 px), icon
  buttons `size-8` and `size-7`. Corners are shadcn's family from
  `--radius` (10 px): controls `rounded-lg`, cards `rounded-xl`. Borders are
  one hairline in `--border` (`--input` on fields); cards are framed by the
  library's ring. Space for a control only some rows have is reserved on
  every row.
- **Status.** A badge is the dot (`size-2`, 8 px) and the label in the tone's
  text color on the tone's background, `rounded-full`, `h-6`, `--text-xs`
  medium, `px-2.5`. In a row the badge shows only the dot
  and the label without background; on the task page it shows both. The
  working dot pulses (`--pulse-duration`); no other dot moves; Archived and
  Ended show no dot.
- **Timestamps.** Relative ("4 min ago", "yesterday") in `--muted-foreground`
  with the absolute ISO time in the hover title.
- **Motion.** Streaming text shows a caret (`--caret-duration`); the working
  dot pulses. State transitions (hover, focus, an expander's chevron, a
  dialog or menu opening) take `--duration-fast` on `--ease-out` and never
  move layout; nothing animates on load. `prefers-reduced-motion` stops the
  two animations and collapses every transition.
- **Panels.** A region renders once its data is known: the list shows
  skeleton rows of `h-14` (56 px) while loading and never a partial row; the
  result card is absent until the task has loaded, then present with its
  stage, never a spinner inside a card.
- **Tool output.** Collapsed by default behind an expander that states the
  line count ("142 lines"); expanded output is monospace on `--code`,
  wrapped, never cut without a visible "…and 3,400 more lines" line and a
  control that shows the rest.
- **Focus.** Every focusable element shows the ring: `--ring-width` of
  `--ring` at `--ring-offset`.
- **Theme.** Light on `:root`, dark under `.dark`, chosen from the header's
  appearance menu (light, dark, system) and applied to `<html>` before the
  first paint by the app's own script, so the Content-Security-Policy stays
  at `script-src 'self'`; both themes use the same token names.
- **Surfaces.** Three neutral layers: the page (`--background`), a card on it
  (shadcn Card: `--card`, the library's hairline ring, `rounded-xl`) and the
  surface a panel header sits on (`--surface`). A panel header is separated
  from the panel's body by that tone alone, never by a line; the only lines
  inside a panel are between turn groups in the timeline. A hovered row or
  menu item takes `--hover`. Section headings are `--text-sm` medium in
  `--muted-foreground`, sentence case, with the section's meta at
  `--text-xs` on the same line.

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

- **Header.** Full width, `h-14` tall, sticky, bottom border `--border`,
  the content in the one container (`max-w-6xl`). Left: the mark (a
  `--primary` square with the hammer) and "Workbench" as the link to the
  list. Right: two outline badges at `--text-xs`, the membership rule's
  display name with the members icon and the environment with a dot (the
  attention tone for production), the appearance menu, and the actor's
  avatar (initials when GitHub provides none) opening a menu with the login
  and "Sign out". Below 640 px the badges move into the avatar menu. No
  other navigation: the list is the root.
- **Composer.** A card (`--card`, `--border`, the library's ring,
  a shadcn Card, `rounded-xl`, content `p-4`). Row one: the repository picker with
  the repository icon and the base ref input with the commit icon side by
  side, each `h-8`, the picker taking 2/3. Row two: the request
  textarea, three lines at `--text-base`, growing to eight. Row three: one
  line of `--text-xs` muted copy on what the agent will do with the ⌘↵
  shortcut as keycaps, and the "Start task" button right-aligned, primary.
  The picker is a shadcn Select listing the permitted repositories with their
  default branch as the ref placeholder; the ref input takes a branch, tag
  or commit. Disabled until the workspace bootstrap has answered; the button
  is disabled while the request is empty and while a submission is in
  flight, and reads "Starting…" then. A problem (conflict or refusal) is a
  `--status-failed-bg` block between the textarea and the footer.
- **The list panel.** The tabs, the rows and the page loader share one
  card (shadcn Card, `rounded-xl`). The tab bar is `h-12` on `--surface`
  with no line under it: shadcn Tabs in the line variant, two buttons,
  "Active (n)" and "Archived", `--text-sm`, the selected one medium and
  underlined, the other regular in `--muted-foreground`. The count comes
  from the loaded rows and says so on hover ("12 loaded"). The rows sit in
  `py-2` (8 px) of air under the bar; the page loader is a `h-14` (56 px)
  line under them on the card itself.
- **Row.** `h-16` (64 px), no border, `px-5` so its text shares the
  composer's content edge, three columns on a fixed template: status `w-32`
  (128 px), title and meta flexible, result stage and archive `w-32`
  (128 px), `gap-4` between them. Line one: the badge (dot and label,
  regular weight in the tone's color) in the first column and the title at
  `--text-base` medium, ellipsized at one line. Line two, `gap-1` under the
  title: the actor's avatar (`size-4`, 16 px) and login, the repository and
  ref in mono, and the relative age, all at `--text-xs` in
  `--muted-foreground`. The third column, vertically centered across both
  lines: the result stage word ("base", "changes", "published") as plain
  `--text-xs` muted text when present, then the archive control
  (`size="sm"` (28 px), icon button, lucide `archive`, or `archive-restore`
  on an archived row) which exists on every row and is visible on hover and
  focus, with a tooltip naming it.
  A Working row with queued turns reads "Working, 2 queued". A hovered or
  focused row takes `--hover`. A row that needs attention (failed or not
  started) is tinted `--attention-row` across its whole surface; nothing
  is signalled by a side stripe. The whole row is a link to the task page;
  the archive control stops propagation.
- **Page loader.** A `h-14` (56 px) line holding a secondary "Load more"
  button while `nextCursor` is present; a `--text-xs` muted "That's every
  task" line when it is null; three skeleton rows while a page loads.

### At 390

Same order, one column, gutter `px-4`. The header keeps the title and
the avatar; the display name moves to the avatar's hover. The composer
stacks: picker, ref, textarea, button full width. The row keeps its
`h-16` (64 px) on a three-column template (status auto, title flexible,
archive `size="sm"` (28 px)): line one is the title; the result stage is not
shown below 768 px, the badge carries the state and the task page the stage;
line two holds the badge, the actor, the repository and ref in mono, and the
age at `--text-xs`; the archive control stays reserved at the right edge,
centered across both lines, and is always visible, since there is no hover.

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

- **Header.** The app header as on the list. Below it a "← Tasks" link
  with the arrow icon, `--text-sm` medium in `--muted-foreground`.
- **Title row.** The title at `--text-xl` medium (the first line of the
  request), the full badge right, `gap-3` (12 px) to the meta line. Below at `--text-sm` in
  `--muted-foreground`, each item with its icon: repository and ref (mono,
  the repository icon), the actor with the avatar, started age, the task id
  (mono, eight characters, the full id on hover) and "continues <id>" as a
  link when set.
- **Columns.** From 1024 px: left 5/12, right 7/12, `gap-10` (40 px) between
  them and between the left column's sections; below 1024 px the sections
  stack `gap-10` apart. The left column is the request, then the result
  card, then the conversation;
  the right column is the timeline, sticky to the viewport with its own
  scroll so a long timeline never pushes the conversation off screen.
- **Request.** A card with the request text at `--text-md`, rendered as
  Markdown, the heading "Request" above.
- **Result card.** Heading "Result" with "reported by turn n" right of it.
  The stage as a pill on the card's first line, the ready tone's text on
  its background ("base", "changes", "published"), or, when the result came
  from an earlier turn than the last settled one, a muted pill followed by
  "Finished, no new changes reported · result from turn n" in
  `--muted-foreground`. Then a definition list, `--text-sm`, keys at
  `--muted-foreground` in a `w-16` (64 px) column: base (SHA as a `--muted` mono
  chip, ref), branch (mono), commit (SHA chip), PR (number, "draft" when so,
  external link), checks (each command mono with the check or cross icon
  and the summary, suffixed "(reported)" because it is the agent's claim),
  and the compare link from base to commit. Absent fields are absent rows,
  not dashes; without a result the heading stays and a dashed `--border`
  box says "No result reported yet".
- **Timeline.** A panel (`--card`, the library's ring, shadcn Card) whose
  `h-12` header on `--surface` reads "Activity" with "n turns · n calls"
  right, no line under it. Turn groups have `p-3` (12 px) of air and are
  separated by `--border`; each starts with a `--text-xs` rule: a dot in
  the turn's outcome tone (completed neutral, failed red, stopped amber,
  running working), "Turn n" medium in `--foreground`, the age, a
  hairline, and the outcome word right ("completed", "in progress",
  "queued", "failed", "stopped"). Each tool call is a `h-8` (32 px) button
  row that takes `--hover`, `gap-0.5` (2 px) apart: the chevron (turning
  when expanded), the tool name at `--text-xs` regular muted in a fixed
  column, the command at `--text-xs`
  mono ellipsized, and on the right the outcome: the check icon in the
  ready tone with the duration and line count muted, the cross icon with
  "exit n" in the failed tone, a pulsing dot with "running", the clock
  icon with "timed out after …" in the failed tone. Expanded, the output
  block follows: `--code` background, `--code-foreground`, `--text-xs`
  mono, wrapped, `rounded-md`, at most 40 lines then the "…and n more
  lines" line with "Show all". A `report` call shows its input as the
  definition list the result card uses, on `--surface`. Message deltas are
  not in the timeline; they are the conversation.
- **Conversation.** Heading "Conversation". Messages `gap-6` (24 px)
  apart, alternating: the actor's avatar and login as the speaker for user
  turns, the agent mark and "agent" for the assistant, `--text-xs` regular
  in `--muted-foreground` `gap-2` above the message; a user message sits on
  a `--surface` block (`rounded-xl`, `px-4 py-3`), the assistant's Markdown
  is rendered as prose; a streaming message ends with
  the caret. A failed turn renders the failure copy in the failed tone as a
  message-shaped block with the code in mono after it; a cancelled turn a
  muted "Stopped" line with the stopping dot. Then the follow-up composer:
  a textarea of two lines growing to six, a primary "Send" button with the
  ⌘↵ keycaps beside it; disabled and explained ("This task has ended") when
  the session is ended.
- **Controls.** One row, `h-8`: "Send" left; "Stop" with the
  square icon (secondary, enabled while working or queued, reads
  "Stopping…" disabled while the stop settles), "Archive" / "Unarchive"
  with the archive icon (secondary), "End" with the cross icon (destructive
  outline, opens a confirm dialog: "End this task? Queued work is cancelled
  and the conversation becomes read-only. The branch and the pull request
  stay on GitHub.") right. Every control keeps its place when disabled.

### At 390

One column: header, title row (badge below the title, meta wrapping), the
request, the result card, the timeline, the conversation, the composer, the
controls. The timeline is not sticky. Tool entries keep `h-8` (32 px)
on one line at both widths: the command is ellipsized with the full text in
its hover title, and the outcome stays on the right. Controls wrap to two
rows of full-width buttons: Send alone, then Stop, Archive, End in thirds.

## States

Every state has a fixture that renders it without a live run: rows under
`dev/fixtures/rows/`, event logs under `dev/fixtures/logs/`, both authored to the
design's seams until Development recordings replace them (their READMEs say
which). The screenshot suite opens each log fixture as a session of its own
whose status, activity and result are derived from the log, so the badge and
the timeline agree on every task-page capture.

| Component | State | Shows | Fixture |
| --- | --- | --- | --- |
| TaskList | loading | Three skeleton rows of `h-16` (64 px), no text | (none: rendered before data) |
| TaskList | empty | "No tasks yet. Describe one above to start." in `--muted-foreground`, centered in a 64 px tall box | `rows/empty.json` |
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
| Composer | idle | Picker, ref, empty textarea, disabled button | (none; `dev/test/submission.test.ts` fakes the workspace and repository answers) |
| Composer | bootstrapping | Every control disabled, no text change | (rendered before `workspace` answers) |
| Composer | submitting | Button "Starting…" disabled, fields read-only | (interaction) |
| Composer | conflict | Inline problem above the button: "A task with this id already exists with a different request. Keep editing or start over." Draft kept | (none; `dev/test/submission.test.ts` fakes the conflict) |
| Composer | refused | Inline problem from `failureCopy` (for example insufficient credits). Draft kept | (none; `dev/test/submission.test.ts` fakes the refusal) |
| Composer | no repositories | Picker disabled with "No repositories are connected" | (none; `dev/test/submission.test.ts` fakes the empty list) |
| StatusBadge | each state | The dot rule and the label from `DISPLAY` | (derived from the row fixtures) |
| ActivityTimeline | loading | Three `h-8` (32 px) skeleton entries | (rendered while replaying) |
| ActivityTimeline | empty | "Nothing has run yet." | `logs/created-only.json` |
| ActivityTimeline | streaming | A running entry with the pulsing dot, earlier entries settled | `logs/working.json` |
| ActivityTimeline | error | Failed turn rule in the failed tone; entries before it intact | `logs/turn-failed-runtime-lost.json` |
| ActivityTimeline | terminal | Every turn settled, the last rule completed or cancelled | `logs/completed.json`, `logs/cancelled.json` |
| ToolCall | running | Chevron, name, command, pulsing dot | `logs/working.json` |
| ToolCall | succeeded, collapsed | ✓ and duration, "n lines" on the chevron | `logs/completed.json` |
| ToolCall | succeeded, expanded | The output block | (interaction on `logs/completed.json`) |
| ToolCall | failed | ✗, the tool's message in the failed tone; the turn continues | `logs/tool-failed.json` |
| ToolCall | timed out | "timed out after 120 s" in the failed tone; the turn continues | `logs/tool-timed-out.json` |
| ToolCall | report | The definition list of the reported fields | `logs/completed.json` |
| ResultCard | none | "No result reported yet" line, no card | `rows/idle.json` |
| ResultCard | base | Stage "base", one row | `rows/result-base.json` |
| ResultCard | changes | Stage "changes", base, branch, commit, checks, compare link | `rows/ready-changes.json` |
| ResultCard | published | Stage "published", plus the PR row | `rows/ready-published.json` |
| ResultCard | older turn | "Finished, no new changes reported · result from turn n" | `rows/idle-old-result.json` |
| Conversation | replaying | "Loading the conversation…" | (rendered while replaying) |
| Conversation | streaming | The last assistant message with the caret | `logs/working.json` |
| Conversation | failed turn | The failure copy block with the code | `logs/turn-failed-runtime-lost.json` |
| Conversation | stopped turn | The "Stopped" line | `logs/cancelled.json` |
| Conversation | ended | Composer disabled, "This task has ended" | `logs/ended.json` |
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

## What the built screens changed

Recorded after the first screenshot suite ran over the application (`dev/design/screens/app/`), with the reason for each departure from the sections above.

- **Header.** Shows the environment beside the membership display and a Sign out control; the avatar appears only when GitHub returns one. The app needs a way out of the session, and the environment is the one configuration fact a member should see.
- **Task page title.** The h2 is the task's title label (the first line of the request) at `--text-lg`, wrapping when long; there is no clamp. A clamp would hide the words that identify the task; the list is where titles are cut to one line.
- **Tool entries at 390.** One line at both widths with the command ellipsized (full text in the hover title), not a second line. One entry shape keeps `h-8` (32 px) true everywhere.
- **Timeline while thinking.** A running turn with no tool call yet shows a "Thinking" row with the working dot, so the timeline is never empty while the badge says Working.
- **Failure in two places.** A failed turn's copy appears under its turn in the timeline and as the marker after its messages in the conversation, both from `failureCopy`. The timeline reader and the conversation reader each see it where they are.
- **Composer.** The repository picker starts empty with "Repository" as its placeholder and the base-ref input shows the chosen repository's default branch as its placeholder; the button is disabled until both a repository and a request exist.
- **Skeletons and dialogs do not move.** Loading rows are still blocks and the End dialog opens without a fade or zoom, so streaming text and the working dot remain the only motion.
- **One focus ring.** The shadcn primitives' own translucent ring was removed; every focusable element shows the `--ring` outline from `src/app/tokens.css`.
- **Air, rhythm and weight.** The first captures on one system still read
  dense and heavy: one interval (8 px inside, 24 px between everything)
  repeated until nothing had more weight than anything else, medium weight
  on nearly every text role, and lines everywhere (a divider under each
  row, a hairline under each surface band, chips behind stage words). The
  rhythm above replaced the one interval: 8 within a group, 12 from a
  heading to its panel, 16 between groups in a card, 32 to 40 between
  sections, 20 of inset in every card and row, rows `h-16`. Weight went
  down to two: regular everywhere, medium for one emphasis per context.
  Row dividers, the hairlines under surface bands and the stage chips went;
  tone and cadence separate what lines used to. The repository and ref
  moved to the row's meta line so the title stands alone. Nothing about
  size, border color or control height changed, and the measurement gate
  passed unchanged apart from the row height it measures for equality.
- **One sizing system.** The measures the specification first named as its own tokens (a row height, two control heights, gutters, two container widths, a dot and an avatar size, a spacing scale, a radius family) were a second system beside the shadcn primitives' own; wherever the two met, heights, corners and border weights disagreed and the interface read rough. They are gone: the application is on Tailwind's 4 px scale and shadcn's sizes, radii and border lightness (`--border` at shadcn's default with the neutral tint; `--ring` stays the accent because a focus indicator needs 3:1). Cards are shadcn's Card, the filter is Tabs, the composer, the request, the result and the timeline are Cards, task rows are three fixed columns so their edges align down the list, and `dev/e2e/measure.spec.ts` asserts all of it on the rendered page. The mockups keep the old measures in their own stylesheet.
