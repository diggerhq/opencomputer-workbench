# OpenComputer workbench

A small coding workbench: delegate repository tasks to an agent, leave, and
return to verified changes and a draft pull request. The web application is
browser UI plus thin authenticated routes that run unchanged on Cloudflare
Workers and Vercel. It keeps no datastore, queue or background worker of its
own: every task is one [OpenComputer Serverless Agents](https://docs.opencomputer.dev/agents/overview)
session, and GitHub holds the code and the review.

This repository is being built. The README takes its final shape once the
first complete task loop has run.
