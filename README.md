# OpenComputer Workbench

Hand off coding tasks and come back to pull requests. Pick a GitHub repository
and a starting branch, tag or commit. The agent clones it, makes the change,
runs checks and opens a draft PR. Inspect its commands, send a follow-up, or
stop the current turn.

The workbench is a React app with stateless Hono routes. [OpenComputer
Serverless Agents](https://docs.opencomputer.dev/agents/overview) runs the coding
harness and computers, and stores tasks, conversations and results. You deploy
the web app; there is no application database, queue or background worker to
operate.

![A task with its branch, draft pull request, reported checks and command activity. Shown with sample data.](design/screens/app/task-completed-1440-light.png)

## Hand off a task

Choose a repository and a change you would normally hand to a teammate. You
can start several independent tasks, each in its own session and computer.

Once a task is running, close the tab—or stop the local web server. The agent
keeps working on OpenComputer. Start the app again and open the task: its
conversation, commands and latest result are still there. The same works
after redeploying the app or signing in from another browser.

Review the commit comparison and draft PR, then send a follow-up such as
“cover the empty-input case too.” The agent continues on the same branch and
updates the same PR. GitHub remains the code review surface.

## Run it

You need Node.js 22. Clone the repo and install dependencies:

```sh
git clone https://github.com/diggerhq/opencomputer-workbench.git
cd opencomputer-workbench
npm ci
```

**To use your repositories**, follow [setup](docs/setup.md): deploy the agent
to your OpenComputer project, connect GitHub and configure sign-in. Then run
`npm run dev` and open [localhost:3200](http://localhost:3200).

**To explore the UI first**, open it with sample tasks. No credentials are
required and no live agents run:

```sh
npx playwright install chromium
npm run dev:fixtures
```

The web app has adapters for Cloudflare Workers and Vercel. These buttons
deploy the app; [configure the agent and access first](docs/setup.md#host-the-web-app).

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/diggerhq/opencomputer-workbench)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdiggerhq%2Fopencomputer-workbench&env=OPENCOMPUTER_API_KEY,OPENCOMPUTER_PROJECT_ID,OPENCOMPUTER_ENVIRONMENT,OPENCOMPUTER_AGENT_ID,GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,WORKBENCH_COOKIE_KEY,WORKBENCH_MEMBERSHIP,WORKBENCH_ORIGIN)

## What the example builds

The [worker](opencomputer/agents/worker/agent.ts) is a short TypeScript function:
task instructions and React-style hooks declaring its model, managed GitHub
connection and one application tool. Its setup is:

```ts
const input = useInput();
useModel("anthropic/claude-sonnet-4.6");
useConnection(github);
useTool(report);
```

OpenComputer supplies the coding harness, shell and computer. The custom
[`report` tool](opencomputer/agents/worker/tools/report.ts) publishes a typed
result on the session. It verifies commit, branch and PR references against
GitHub; check outcomes are reported by the agent. The UI reads that result
directly, without extracting it from chat text.

The app handles sign-in, access checks and rendering:

- [Task routes](src/server/tasks.ts) create and list OpenComputer sessions.
  Labels hold the title, repository, requester and archive state.
- [`useAgent`](https://docs.opencomputer.dev/agents/react) connects the browser
  to the conversation through [authenticated routes](src/server/session-proxy.ts).
- [Workers](src/hosts/workers.ts) and [Vercel](api/index.ts) run the same Hono
  handler. Requests can land on a fresh process; task state lives on OpenComputer.

Your deployment uses your OpenComputer project. Access can be restricted to a
GitHub organization, team or single user. **Members share all tasks and connected
repositories**; this is a shared workbench, with no per-user repository permissions.
The OpenComputer API key stays on the server. [Access details](docs/setup.md#access).

## Develop

`npm run check` runs typechecks, lint, unit tests and the build.
`npm run test:e2e` exercises the UI with Playwright.
`npm run doctor` checks the agent definition; `npm run deploy:agents` publishes
it to the linked project's Development environment.

See [AGENTS.md](AGENTS.md) for the source map and invariants.
