# UI review checklist

Every pull request that touches `src/app/` is reviewed against this list, on
the captures the screenshot suite writes to `design/screens/app/` at 390 and
1440 pixels in both themes, worst finding first. The list does not change per
review; a new rule is added here when a bug shows the list missed it.

1. **Alignment to the grid.** Every edge sits on a multiple of `--space-2`;
   rows are exactly `--row-height`; controls are `--control-height`; text
   baselines in a row share one line. Compare the row above and below.
2. **No layout shift between states.** Loading, empty, streaming, error and
   terminal renderings of a component occupy the same box. Space for the
   archive control, the result stage and the queued count is reserved on
   every row whether or not the row has them; a badge without a dot keeps
   the dot's space in a row. A panel appears once its data is known, never
   mid-load.
3. **Focus rings from tokens.** Tab through the screen: every focusable
   element shows the `--ring` outline at `--ring-width` and `--ring-offset`,
   nothing shows a browser default, nothing hides it, and no primitive
   carries a ring of its own (`src/app/components/ui/` has none).
4. **Contrast in both themes.** Text at or above 4.5:1, status dots at or
   above 3:1 against the page. `node design/contrast.mjs` checks the tokens;
   the review checks that components use them and nothing else.
5. **Copy from the vocabulary.** Badge labels are the ten words in
   `src/app/vocabulary.ts`; failure copy comes from `failureCopy`; Session
   and turn do not appear on screen. Timestamps are relative with the
   absolute time on hover.
6. **Reserved space for optional controls.** Stop, archive and end keep
   their place when disabled; a disabled control is dimmed, not removed.
7. **Monospace only for commands and output.** Tool output is collapsed
   with an expander that says how much it holds; nothing is truncated
   without saying so.
8. **Lists keyed by stable identity.** Rows by session id, timeline entries
   by call id or event sequence, messages by their log id. Expand a tool
   call, wait for new events, confirm it stays expanded.
9. **Motion limited to streaming text and the working dot.** No other
   animation: skeletons do not pulse, dialogs and menus open without a fade
   or zoom, nothing spins; `prefers-reduced-motion` stops both allowed
   animations.
10. **Both viewports, both themes.** The finding is reported with the
    capture it was seen in; a fix is confirmed on all four captures.

## Running the capture

The suite starts the real application on port 3201 with fixture values in
its environment and points it at a replay of the recordings under
`fixtures/` (the fixture server in `e2e/fixture-server.ts` on port 3202).
Nothing is configured in a file; nothing reaches OpenComputer or GitHub.

```sh
npx playwright install chromium   # once
npm run test:e2e                  # every state, both viewports, both themes
npx playwright test --project=desktop        # one viewport
npx playwright test -g "the task page"       # one group
```

Captures land in `design/screens/app/<name>-<viewport>-<theme>.png`, 56
files under 300 KB each. `.github/workflows/screenshots.yml` runs the same
command on every pull request and uploads the folder as the `screens`
artifact; a state that does not render fails the job.

The same suite targets a deployed workbench when `BASE_URL` and
`OPENCOMPUTER_API_URL` are set. The cookie is then minted from that
environment's own `WORKBENCH_COOKIE_KEY`, `WORKBENCH_MEMBERSHIP`,
`OPENCOMPUTER_PROJECT_ID` and `OPENCOMPUTER_ENVIRONMENT`, which must be the
deployment's, and the live acceptance spec (`e2e/live.spec.ts`: sign in,
list, open a task, follow up, stop) runs; the fixture-specific state
captures are skipped. Never in CI.

```sh
BASE_URL=https://<workbench-host> OPENCOMPUTER_API_URL=https://app.opencomputer.dev \
WORKBENCH_COOKIE_KEY=… WORKBENCH_MEMBERSHIP=team:<org id>/<team id> \
OPENCOMPUTER_PROJECT_ID=… OPENCOMPUTER_ENVIRONMENT=development \
E2E_LOGIN=<your login> E2E_USER_ID=<your numeric id> npm run test:e2e
```

The static mockups under `design/mockups/` predate the application and
render from `design/tokens.css` alone; they are kept as the design's
reference and are no longer captured. To look at one, open it in a browser
(`?theme=dark` for the dark palette).
