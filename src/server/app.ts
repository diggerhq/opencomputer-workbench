// One Fetch handler for every host. Each host entry builds a Config from its
// own source and calls createApp; nothing in here depends on the process.
import type { AuthDeps } from "./auth";
import type { Config } from "./env";
import { type App, routes } from "./routes";

export type { App } from "./routes";

export function createApp(config: Config, deps?: AuthDeps): App {
  return routes(config, deps);
}
