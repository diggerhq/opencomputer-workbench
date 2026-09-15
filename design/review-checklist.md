# UI review checklist

Every pull request that touches `src/app/` is reviewed against this list, on
the screenshots the end-to-end suite captures at 390 and 1440 pixels in both
themes, worst finding first. The list does not change per review; a new rule
is added here when a bug shows the list missed it.

1. **Alignment to the grid.** Every edge sits on a multiple of `--space-2`;
   rows are exactly `--row-height`; controls are `--control-height`; text
   baselines in a row share one line. Compare the row above and below.
2. **No layout shift between states.** Loading, empty, streaming, error and
   terminal renderings of a component occupy the same box. Space for the
   archive control, the result stage and the queued count is reserved on
   every row whether or not the row has them. A panel appears once its data
   is known, never mid-load.
3. **Focus rings from tokens.** Tab through the screen: every focusable
   element shows the `--ring` outline at `--ring-width` and `--ring-offset`,
   nothing shows a browser default, nothing hides it.
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
   transition, fade or spinner; `prefers-reduced-motion` stops both.
10. **Both viewports, both themes.** The finding is reported with the
    screenshot it was seen in; a fix is confirmed on all four captures.

## Running the capture

The static mockups under `design/mockups/` render from `design/tokens.css`
alone. Recapture them after a token change:

```sh
npx --yes playwright@1.63.0 install chromium
for screen in list task; do
  for width in 390 1440; do
    for theme in light dark; do
      npx --yes playwright@1.63.0 screenshot --full-page --wait-for-timeout=1500 \
        --viewport-size="$width,$([ "$width" = 390 ] && echo 844 || echo 900)" \
        "file://$PWD/design/mockups/$screen.html?theme=$theme" \
        "design/screens/$screen-$width-$theme.png"
    done
  done
done
```

The application captures come from the Playwright suite under `e2e/`, which
renders every state from the recorded fixtures at the same two viewports and
writes to `test-results/screenshots/`.
