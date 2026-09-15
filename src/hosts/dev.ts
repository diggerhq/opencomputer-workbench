// Development entry for @hono/vite-dev-server: `vite dev` serves the SPA and
// these routes in one process. Configuration comes from .env.local (never
// committed); a missing key names itself on the first request.
import { existsSync } from "node:fs";
import { createApp } from "../server/app";
import { readConfig } from "../server/env";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default createApp(readConfig(process.env));
