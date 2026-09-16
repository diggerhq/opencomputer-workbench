# The workbench for agents

A coding workbench on OpenComputer Serverless Agents: a Hono handler and a
Vite SPA in front of one agent. The README serves people; this file serves
agents. The design that decides what is built lives outside this repository.

## Map

- `src/server/app.ts` `createApp(config)`: the one Fetch handler every host runs; `routes.ts` the route table and the error mapping; `problem.ts` the one error shape
- `src/server/env.ts` typed configuration from a host's own source; a missing key names itself
- `src/server/auth.ts` GitHub sign-in and the cookie; `membership.ts` the org, team or user rule with pinned numeric ids
- `src/server/client.ts` the management client from `@opencomputer/sdk/agents`, plus the bounded repeat of an unconfirmed publication and the agent's active deployment
- `src/server/task.ts` `toTask`: the only place OpenComputer facts become app facets (execution, archived, result); `scope.ts` the session check every session-scoped route runs first
- `src/server/tasks.ts` the task routes (list, get, create with the submission envelope, title and archive labels, end, repositories); `session-proxy.ts` the three routes the React hook needs; `request.ts` what the first turn carries
- `src/lib/report.ts` the app's parser for the report, built from the schema the report tool declares
- `opencomputer/project.ts` the project and its one agent; `opencomputer/agents/worker/agent.ts` the worker: the GitHub connection, one model, one tool and its instructions; `read-task.ts` what the agent knows about its task
- `opencomputer/agents/worker/tools/report.ts` the report tool: the one source of the result type, the schema it declares to the model, and the verification of commit, branch and PR references against GitHub
- `.opencomputer/project.json` the linked project and agent ids the CLI wrote
- `src/hosts/workers.ts` Cloudflare Workers entry; `api/index.ts` Vercel entry; `src/hosts/dev.ts` the Vite dev server entry
- `src/app/routes/` the two screens (TanStack Router, file based): `index.tsx` the list, `tasks.$id.tsx` the task page
- `src/app/components/` the list (`Composer`, `TaskList`, `TaskRow`, `StatusBadge`), the page (`TaskPage`, `ActivityTimeline`, `ToolCall`, `ResultCard`, `Conversation`, `Controls`, `Markdown`, `RelativeTime`, `format.ts`), `SignIn`, and the shadcn primitives under `ui/`
- `src/app/activity.ts` combines the hook's turns with event notes, marked `STOPGAP(C5)`; `hooks/use-activity.ts` feeds it from `useAgent`
- `src/app/lib/api.ts` the browser's view of the app's routes; `lib/submission.ts` the envelope held until the admission receipt; `lib/display.ts` the display state from the three facets; `lib/ulid.ts`
- `src/app/vocabulary.ts` the words and the failure copy; `tokens.css` every visual value, `styles.css` maps it into Tailwind; `src/app/public/_headers` the content security policy the hosts serve
- `docs/setup.md` the setup guide the README links, the one file outside `dev/` that is not the example itself
- `dev/` everything auxiliary, so the root is the example: `dev/test/` the unit tests, `dev/e2e/` the visual suite, the fixture replay of the management API and the walkthrough, `dev/fixtures/` one session row per task state and one event log per scenario (each README says which are authored and which are recorded), `dev/design/` the two screens, the mockups, the captures, the review checklist and the design tooling's `PRODUCT.md`, `dev/scripts/membership-id.mjs`, and the Biome, Vitest and Playwright configs
- `wrangler.jsonc`, `vercel.json` host configuration: static assets and the handler, nothing that keeps state
- `dev/test/` covers the server, the pure client modules and the components: configuration, cookie, membership, routes, the projection over every row fixture, create and retry, the proxy, the submission envelope, the activity view over log fixtures, the page through the route tree, both host entries, statelessness; `components.json` stays at the root because the shadcn generator reads it from the project directory

## Commands

- `npm run dev` port 3200, strict; the SPA and the routes in one process, configuration from `.env.local`
- `npm run dev:fixtures` the real application over sample fixtures on the same port, a browser opened already signed in, or `-- --no-browser` for a sign-in snippet to paste into your own; for looking, not for tests
- `npm run check` typecheck of the application and the agent directory, lint, unit tests, build; what CI runs; `npm run test:e2e` the visual suite over the fixture replay, captures under `dev/design/screens/app`
- `npx wrangler dev` the Worker with `dist/client` after `npm run build`, configuration from `.dev.vars`
- `npm run membership-id -- team:<org>/<slug>` prints the `WORKBENCH_MEMBERSHIP` line
- `npm run doctor` checks the agent directory; `npm run deploy:agents` deploys the worker to the linked project's development environment (`npx opencomputer login` first)

## Invariants

- The server routes are the only holder of the OpenComputer key; the browser gets a cookie and the app's own routes.
- Every `/api` route requires a member; every POST and PATCH requires the app's own origin; every session-scoped route checks the session's project, environment and agent before forwarding.
- Nothing depends on process-local state surviving a request; the hosts declare no persistence, queue or schedule (`dev/test/stateless.test.ts`).
- The workbench never substitutes a shipping path for a missing OpenComputer contract; stopgaps carry a `STOPGAP(Cn)` comment naming their deletion condition.
- Agent code imports nothing from outside its own directory; the report schema lives with the tool and the app derives its type and parser from it.
- The agent is deployed with the OpenComputer CLI from `opencomputer/`; sessions pin the deployment they started on, so a redeploy changes new tasks only.
- Never print or commit secrets; `.env.local` and `.dev.vars` hold them and are ignored.

## Where things are decided

The public contracts are the OpenComputer docs on the management API,
sessions, events, the React hook and GitHub connections. Design notes and the
build ledger are kept outside this repository.
