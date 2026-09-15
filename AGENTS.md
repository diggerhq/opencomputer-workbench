# The workbench for agents

A coding workbench on OpenComputer Serverless Agents: a Hono handler and a
Vite SPA in front of one agent. The README serves people; this file serves
agents. The design that decides what is built lives outside this repository.

## Map

- `src/server/app.ts` `createApp(config)`: the one Fetch handler every host runs; `routes.ts` the route table; `problem.ts` the one error shape
- `src/server/env.ts` typed configuration from a host's own source; a missing key names itself
- `src/server/auth.ts` GitHub sign-in and the cookie; `membership.ts` the org, team or user rule with pinned numeric ids
- `src/server/oc.ts` the management API wrapper, marked `STOPGAP(C5)`; the only module that knows OpenComputer's paths and shapes
- `src/server/task.ts` `toTask`: the only place OpenComputer facts become app facets (execution, archived, result); `scope.ts` the session check every session-scoped route runs first
- `src/server/tasks.ts` the task routes (list, get, create with the submission envelope, title and archive labels, end, repositories); `session-proxy.ts` the three routes the React hook needs; `request.ts` what the first turn carries
- `opencomputer/project.ts` the project and its one agent; `opencomputer/agents/worker/agent.ts` the worker: the GitHub connection, one model, one tool and its instructions
- `opencomputer/agents/worker/tools/report.ts` the report tool: the one source of the result type the app validates against, the schema it declares to the model, and the GitHub verification of every field it is given
- `fixtures/rows/` one session row per task state, authored to the design's seams until Development recordings replace them (its README says which)
- `src/hosts/workers.ts` Cloudflare Workers entry; `api/index.ts` Vercel entry; `src/hosts/dev.ts` the Vite dev server entry
- `src/app/` the React SPA: `routes/` (TanStack Router, file based), `components/` (the list: `Composer`, `TaskList`, `TaskRow`, `StatusBadge`), `lib/api.ts` the browser's view of the app's routes, `lib/submission.ts` the envelope held until the admission receipt, `lib/display.ts` the display state from the three facets, `vocabulary.ts` the words, `styles.css` the tokens
- `wrangler.jsonc`, `vercel.json` host configuration: static assets and the handler, nothing that keeps state
- `scripts/membership-id.mjs` resolves the membership rule to pinned ids once, at setup
- `test/` Vitest over the server and the pure client modules: configuration, cookie, membership, routes, the projection over every row fixture, create and retry, the proxy, the submission envelope, both host entries, statelessness

## Commands

- `npm run dev` port 3200, strict; the SPA and the routes in one process, configuration from `.env.local`
- `npm run dev:fixtures` the real application over the recorded fixtures on the same port, a browser opened already signed in, or `-- --no-browser` for a sign-in snippet to paste into your own; for looking, not for tests
- `npm run check` typecheck, lint, unit tests, build; what CI runs
- `npx wrangler dev` the Worker with `dist/client` after `npm run build`, configuration from `.dev.vars`
- `npm run membership-id -- team:<org>/<slug>` prints the `WORKBENCH_MEMBERSHIP` line
- `npm run doctor` checks the agent directory; `npm run deploy:agents` deploys the worker to the linked project's Development environment (`npx opencomputer login` first)

## Invariants

- The server routes are the only holder of the OpenComputer key; the browser gets a cookie and the app's own routes.
- Every `/api` route requires a member; every POST and PATCH requires the app's own origin.
- Nothing depends on process-local state surviving a request; the hosts declare no persistence, queue or schedule (`test/stateless.test.ts`).
- The workbench never substitutes a shipping path for a missing OpenComputer contract: stopgaps carry a `STOPGAP(Cn)` comment naming their deletion condition; development stubs run only with `WORKBENCH_DEV_STUBS=1`.
- The agent is deployed with the OpenComputer CLI from `opencomputer/`; sessions pin the deployment they started on, so a redeploy changes new tasks only.
- Never print or commit secrets; `.env.local` and `.dev.vars` hold them and are ignored.

## Where things are decided

The public contracts are the OpenComputer docs on the management API,
sessions, events, the React hook and GitHub connections. Design notes and the
build ledger are kept outside this repository.
