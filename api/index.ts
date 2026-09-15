// Vercel entry: one function behind the /api/* and /auth/* rewrites in
// vercel.json; the SPA is served from dist/client. Same app as the Worker.
import { handle } from "hono/vercel";
import { createApp } from "../src/server/app";
import { readConfig } from "../src/server/env";

export default handle(createApp(readConfig(process.env)));
