# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engineers on one team who share a set of GitHub repositories. Their situation:
they have a bounded coding task they would rather hand off than do, they want
to keep working on something else while it runs, and they will come back
later, on another machine or from a phone, to see what happened. Their job in
the workbench: describe the task, leave, return to a tested branch and a draft
pull request, steer with a follow-up or stop a turn, and take the review to
GitHub. A workspace is a trusted group: every member sees every task.

## Product Purpose

A coding workbench that delegates repository tasks to an agent. Each task is
one durable conversation with one agent that clones the repository, edits,
runs the checks the repository defines, pushes a branch and opens a draft pull
request, then reports what it did. Success is that a person can close the
browser at any point and find every task exactly where it was, from any
browser, and that the result they act on is a commit and a pull request on
GitHub, not a claim in a chat.

## Positioning

The application keeps no state of its own: no database, queue or background
worker. Every task lives in the agent platform as a session with its labels,
its event log and its typed result, and GitHub holds the code and the review.
A fresh deployment of the application recovers all work. A neighboring
product that runs its own control plane cannot truthfully claim that.

## Operating Context

Used beside GitHub and a terminal. Sign-in is GitHub; repository access is a
GitHub App installation chosen by the team. Tasks run for minutes to an hour;
the list is checked a few times a day and a task page is watched while a turn
runs. Phones are a real second screen for checking status and sending a
follow-up, not for composing long requests. Two screens only: the task list
with its composer, and a task page with the request, the result, the activity
timeline and the conversation. No sidebar, no settings area.

## Capabilities and Constraints

- Create a task on a repository at a base revision; follow up on it; stop a
  running turn; archive; end. Nothing else is a user action.
- A task's state is three independent facets: execution (starting, not
  started, queued, working, stopping, idle, failed, ended), archived, and the
  reported result (none, base, changes, published). "Ready for review" is
  derived, never stored.
- The fixed vocabulary on screen: Starting, Not started, Queued, Working,
  Stopping, Idle, Ready for review, Failed, Archived, Ended. "Session" and
  "turn" are platform words and appear only in the timeline's turn labels.
- A failed command inside a turn is a timeline entry, never a failed task.
- Review happens on GitHub through links; the application shows no diffs of
  its own and holds no repository credential.
- The result card shows only what the agent reported and the platform
  committed; the checks are labelled as reported because they are the agent's
  claim.
- Runs unchanged on Cloudflare Workers and Vercel from one commit; nothing may
  depend on process-local state surviving a request.
- Undecided: per-user read state ("unread") has no owner and is not shown.

## Brand Commitments

The name on screen is "Workbench"; the repository is `opencomputer-workbench`.
Inter for text and Geist Mono for commands, output, commit shas and branch
names are fixed. The palette is ink on paper with one accent and neutral
surfaces; light and dark themes share one token set. Both screens are
specified in `dev/design/screens.md` and the tokens in `src/app/tokens.css`. No
other brand assets exist.

## Evidence on Hand

Recorded fixtures under `dev/fixtures/rows/` and `dev/fixtures/logs/` render every
state without a live run; they are authored to the platform's documented
shapes until recordings from a live run replace them. Captures of every state
at 390 and 1440 in both themes live under `dev/design/screens/app/`. There are no
customer quotes, benchmarks or usage numbers; do not invent any.

## Product Principles

- The platform does the work; the application is sign-in, policy and
  rendering. Any feature that needs state the platform does not hold is a
  platform request, not an application addition.
- Show facts, not interpretations: a state is what the platform records, a
  result is what it committed, a link goes to the thing itself.
- Every state renders from a recording, so the interface is reviewed on
  captures, not on a live run.
- The tool disappears into the task: earned familiarity over expression,
  density where the user is working, calm everywhere else.
- One system for size, spacing and weight; a value that is not on the scale
  does not ship.

## Accessibility & Inclusion

Keyboard-first for the two flows that matter: compose and start a task
(⌘↵), send a follow-up (⌘↵), stop, archive, end. Every focusable element shows
the token focus ring. Text contrast at or above 4.5:1 and status dots at or
above 3:1 in both themes, checked by `dev/design/contrast.mjs`. State is never
carried by color alone: every dot has its word. Reduced motion stops the two
animations.
