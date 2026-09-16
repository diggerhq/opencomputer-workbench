# Configuration and hosting

Start with the [README quickstart](../README.md#quickstart) to deploy the
worker agent and run the web app locally. This guide covers other project
choices, hosting and shared access. [`.env.example`](../.env.example) lists
all application settings.

## Project and environment

To link an existing project dedicated to this workbench, use its ID or slug:

```sh
npx opencomputer link --project YOUR_PROJECT
```

Use the resulting `.opencomputer/project.json` values in the app's
`OPENCOMPUTER_PROJECT_ID` and `OPENCOMPUTER_AGENT_ID`. The CLI's login and
the app's organization API key must have access to that project.

The quickstart and `npm run deploy:agents` target Development. To use
Production, publish the agent there:

```sh
npx opencomputer deploy --alias production
```

Set `OPENCOMPUTER_ENVIRONMENT=production` and attach the managed GitHub
installation to that environment too. Connections are attached separately
per environment; see [GitHub connections](https://docs.opencomputer.dev/agents/github).

## Host the web app

This example includes configuration for Cloudflare. Complete the
[local quickstart](../README.md#quickstart), then use the
[deploy button](../README.md#host-the-app) or deploy your fork with the
checked-in [`wrangler.jsonc`](../wrangler.jsonc).

Set the application variables from `.env.local` as Worker secrets, with
`WORKBENCH_ORIGIN` changed to the hosted app's HTTPS origin. Register
`<origin>/auth/callback` on its GitHub OAuth app; use a separate OAuth app
if you want to keep localhost sign-in working too.

For a manual deployment, run:

```sh
npm run deploy
```

This builds and ships the client assets and server together as one Worker.
The Worker needs no datastore, queue or cron job. For a local Worker preview,
run `npm run build`, put the configuration in `.dev.vars` and run
`npx wrangler dev`.

The web app and agent deploy independently. Publishing another agent version
changes new tasks only; a task already started keeps the deployment the
platform recorded for it.

## Access

The quickstart admits one GitHub user. For a shared workbench, resolve an
organization or team using your authenticated GitHub CLI:

```sh
npm run membership-id -- org:YOUR_ORG
```

Or, for one team:

```sh
npm run membership-id -- team:YOUR_ORG/TEAM_SLUG
```

Use the printed `WORKBENCH_MEMBERSHIP` setting. It contains numeric GitHub
IDs, so renaming an organization, team or user does not change who is admitted.

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

## Setup checks

- **Repositories fail to load or the list is empty:** check that the GitHub
  installation is attached to the configured OpenComputer environment and
  has repositories selected.
- **The agent is not deployed:** check the app's project and agent IDs against
  your updated `.opencomputer/project.json`, and deploy to the environment
  named by `OPENCOMPUTER_ENVIRONMENT`.
- **Sign-in redirects fail:** the OAuth app's callback must be
  `<WORKBENCH_ORIGIN>/auth/callback`, including the local port or hosted HTTPS
  origin exactly.
