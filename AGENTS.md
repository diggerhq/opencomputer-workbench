# The workbench for agents

A coding workbench on OpenComputer Serverless Agents: one TanStack Start
application in front of one agent. The README serves people; this file
serves agents. The design that decides what is built lives outside this
repository.

## Layout

- `opencomputer/` the agent: `project.ts` names the project and its one agent; `agents/worker/agent.ts` the worker (the GitHub connection, the computer's tools, one tool of its own, one model, its instructions); `tools/report.ts` the report tool and the one source of the result type, verified against GitHub; `read-task.ts` what the agent knows about its task
- `src/routes/` every route of the application, one file per path: `__root.tsx` the document and the shell, `index.tsx` the list, `tasks.$id.tsx` the task page; under `api/` and `auth/` the server routes (`workspace`, `repos`, `tasks`, `tasks.$id`, `tasks.$id.end`, `agent/sessions.$id.$action` the three routes the React hook needs, `auth/login`, `callback`, `logout`); `-middleware.ts` the member and same-origin guards they compose
- `src/server/` the modules the server routes call, with no framework imports: `env.ts` configuration read per request (a missing key names itself), `auth.ts` sign-in, the cookie, the origin check and the document's security headers, `membership.ts` the org, team or user rule with pinned numeric ids, `client.ts` the management client from `@opencomputer/sdk/agents`, `scope.ts` the session check every session-scoped route runs first, `task.ts` `toTask`, the only place OpenComputer facts become app facets, `request.ts` what the first turn carries, `problem.ts` the one error shape
- `src/components/` the screens' parts (`Composer`, `TaskList`, `TaskRow`, `StatusBadge`, `TaskPage`, `ActivityTimeline`, `ToolCall`, `ResultCard`, `Conversation`, `Controls`, `Markdown`, `SignIn`), the hooks `use-activity.ts` and `use-now.ts`, and the generated primitives under `ui/`
- `src/lib/` the browser's shared modules: `api.ts` its view of the app's routes, `submission.ts` the envelope held until the admission receipt, `display.ts`, `ulid.ts`, `activity.ts` the hook's turns joined with event notes (`STOPGAP(C5)`), `vocabulary.ts` the words and the failure copy, `report.ts` the report parser built from the tool's schema, `theme.ts`, `format.ts`
- `src/tokens.css` every visual value; `src/styles.css` maps it into Tailwind; `src/router.tsx` and `src/server.ts` the framework's client and server entries of the one artifact
- `wrangler.jsonc` the Worker: the assets and the worker come out of `npm run build`; no persistence, queue or schedule binding
- `.opencomputer/project.json` the linked project and agent ids the CLI wrote
- `docs/setup.md` the setup guide the README links, the one file outside `dev/` that is not the example itself
- `dev/` everything auxiliary: `test/` the unit tests (routes are served by `serve.ts`, the framework's stand-in), `e2e/` the visual suite, the fixture replay of the management API and the walkthrough, `fixtures/` one session row per task state and one event log per scenario (each README says which are authored and which are recorded), `design/` the two screens, the mockups, the captures, the review checklist and the design tooling's `PRODUCT.md`, `scripts/membership-id.mjs`, and the Biome, Vitest and Playwright configs
- `components.json` stays at the root because the shadcn generator reads it from the project directory

## Commands

- `npm run dev` port 3200, strict; the whole application in one process, configuration from `.env.local`
- `npm run dev:fixtures` the real application over sample fixtures on the same port, a browser opened already signed in, or `-- --no-browser` for a sign-in snippet to paste into your own; for looking, not for tests
- `npm run check` typecheck of the application and the agent directory, lint, unit tests, build; what CI runs; `npm run test:e2e` the visual suite over the fixture replay, captures under `dev/design/screens/app`
- `npm run build` the one artifact under `dist/`; `npm run deploy` builds and ships it to Workers; `npx wrangler dev` runs the built Worker locally with `.dev.vars`
- `npm run membership-id -- team:<org>/<slug>` prints the `WORKBENCH_MEMBERSHIP` line
- `npm run doctor` checks the agent directory; `npm run deploy:agents` deploys the worker to the linked project's development environment (`npx opencomputer login` first)

## Invariants

- The server routes are the only holder of the OpenComputer key; the browser gets a cookie and the app's own routes.
- Every `/api` route requires a member; every POST and PATCH requires the app's own origin; every session-scoped route checks the session's project, environment and agent before forwarding.
- Nothing depends on process-local state surviving a request; the Worker declares no persistence, queue or schedule (`dev/test/stateless.test.ts`).
- The workbench never substitutes a shipping path for a missing OpenComputer contract; stopgaps carry a `STOPGAP(Cn)` comment naming their deletion condition.
- Agent code imports nothing from outside its own directory; the report schema lives with the tool and the app derives its type and parser from it.
- The agent is deployed with the OpenComputer CLI from `opencomputer/`. The app addresses it as `<agent>@<environment>` and never handles deployment ids; the platform chooses the deployment and records it on the session, so a redeploy changes new tasks only.
- Never print or commit secrets; `.env.local` and `.dev.vars` hold them and are ignored.

## Where things are decided

The public contracts are the OpenComputer docs on the management API,
sessions, events, the React hook and GitHub connections. Design notes and the
build ledger are kept outside this repository.
