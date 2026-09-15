// Cloudflare Workers entry. Static assets are served by the assets binding;
// only /api/* and /auth/* reach this handler (wrangler.jsonc). The app is
// built from the bindings once per isolate as a convenience; rebuilding it
// on every request would be correct too.
import { createApp } from "../server/app";
import { readConfig } from "../server/env";
import type { App } from "../server/routes";

type Bindings = Record<string, string | undefined>;

const apps = new WeakMap<Bindings, App>();

function appFor(env: Bindings): App {
  let app = apps.get(env);
  if (!app) {
    app = createApp(readConfig(env));
    apps.set(env, app);
  }
  return app;
}

export default {
  fetch(request: Request, env: Bindings): Response | Promise<Response> {
    return appFor(env).fetch(request);
  },
};
