# Set up Workbench

The web app needs an OpenComputer project to run tasks and a GitHub OAuth app
to sign people in. Repository access uses OpenComputer's managed GitHub App,
separately from sign-in.

Prerequisites: Node.js 22, an OpenComputer account and organization API key,
and an authenticated [GitHub CLI](https://cli.github.com/) for resolving the
membership rule. Run `npm ci` in the cloned repository before the steps below.

## Deploy the agent

Sign in to OpenComputer, create and link a project, then deploy the worker:

```sh
npx opencomputer login
npx opencomputer link --create-project "Workbench"
npm run deploy:agents
```

To use an existing project dedicated to this workbench, replace the link command with
`npx opencomputer link --project <project-id-or-slug>`.
The deploy script targets the `development` environment.

The CLI writes the project and agent IDs to `.opencomputer/project.json`.
Copy those values into `OPENCOMPUTER_PROJECT_ID` and `OPENCOMPUTER_AGENT_ID`
when configuring the app below.

In the OpenComputer dashboard, open the project's GitHub connection, install
the OpenComputer GitHub App and select the repositories the agent may use.
**Attach that installation to the project's Development environment.** An
installation alone does not make its repositories available to this environment.
See [GitHub connections](https://docs.opencomputer.dev/agents/github).

## Configure sign-in

[Register a GitHub OAuth app](https://github.com/settings/applications/new)
with these local URLs:

| Field | Value |
| --- | --- |
| Homepage URL | `http://localhost:3200` |
| Authorization callback URL | `http://localhost:3200/auth/callback` |

Keep its client ID and client secret for the next step. This app requests
`read:org` for membership checks; it does not give the agent repository access.

Choose who can sign in. For a personal workbench, resolve your GitHub login:

```sh
npm run membership-id -- user:YOUR_LOGIN
```

For a shared workbench, use `org:YOUR_ORG` or `team:YOUR_ORG/TEAM_SLUG` instead.
The helper uses your GitHub CLI login and prints a `WORKBENCH_MEMBERSHIP` line
with numeric IDs. Copy the line into your configuration. Names are resolved
at setup so a later rename does not change who is admitted.

## Start locally

Create the local configuration:

```sh
cp .env.example .env.local
```

Fill in the placeholders in `.env.local`:

- **OpenComputer:** your organization API key, the two IDs from
  `.opencomputer/project.json`, and `OPENCOMPUTER_ENVIRONMENT=development`.
- **GitHub:** the OAuth app's client ID and secret.
- **Workbench:** the membership line above and a cookie encryption key,
  generated with `openssl rand -base64 32`.

Keep `WORKBENCH_ORIGIN=http://localhost:3200` for local development.
[`.env.example`](../.env.example) documents every variable, including the
optional OpenComputer API origin. The local file is ignored by Git.

```sh
npm run dev
```

Open [localhost:3200](http://localhost:3200), sign in with GitHub and choose
a repository. If repositories fail to load or the list is empty, check that
the GitHub installation is attached to the configured OpenComputer environment
and has repositories selected.

Start a small task and wait for it to begin running. Stop this dev server,
then restart it and reopen the task. Its execution is on OpenComputer; the
local server only serves the UI and forwards authenticated requests. No
tunnel or callback receiver is needed for the agent.

## Host the web app

Complete the agent and access setup above, then use a
[deploy button in the README](../README.md#run-it), or deploy your fork with
the checked-in host configuration:

The host is Cloudflare Workers, configured in [`wrangler.jsonc`](../wrangler.jsonc)
with the application variables as Worker secrets. `npm run build` produces
the one artifact, the client assets and the Worker, and `npm run deploy`
builds and ships it. The Worker needs no datastore, queue or cron job. For a
local Worker preview, build first, put the configuration in `.dev.vars` and
run `npx wrangler dev`.

Set the same application variables as in `.env.local`, with
`WORKBENCH_ORIGIN` set to the deployed app's HTTPS origin. Register
`<origin>/auth/callback` on its GitHub OAuth app; use a separate OAuth app
if you want to keep localhost sign-in working too.

Deploying the web app does not deploy the agent. The two can be updated
independently. Existing tasks keep their pinned agent deployment; a new agent
deployment applies to new tasks.

## Access

Every admitted member can see and manage every task, and start agents with
write access to any repository attached to the configured environment.
There are no roles or per-user repository permissions. Repository selection
in the OpenComputer GitHub connection is the boundary for agent access.
Commits and PRs use the App's identity, with the requester credited.

The OpenComputer key stays on the server. Sign-in state lives in an encrypted
cookie, including the GitHub token used to recheck membership; there is no
application session table. The cookie expires 24 hours after sign-in, and
requests recheck membership when the previous check is an hour old. Rotating
`WORKBENCH_COOKIE_KEY` signs everyone out.
