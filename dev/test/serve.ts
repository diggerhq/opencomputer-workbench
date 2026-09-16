// Serves a request the way the framework would, for the route tests: match
// the path to a route file, run its request middleware in order, then its
// method handler. The tests fix the configuration, the fetch and the clock
// through `configure` first. Unknown paths and methods answer the same 404
// problem the catch-all route gives a member.

import { Route as catchAll } from "../../src/routes/api/$";
import { Route as proxy } from "../../src/routes/api/agent/sessions.$id.$action";
import { Route as repos } from "../../src/routes/api/repos";
import { Route as tasks } from "../../src/routes/api/tasks";
import { Route as task } from "../../src/routes/api/tasks.$id";
import { Route as taskEnd } from "../../src/routes/api/tasks.$id.end";
import { Route as workspace } from "../../src/routes/api/workspace";
import { Route as callback } from "../../src/routes/auth/callback";
import { Route as login } from "../../src/routes/auth/login";
import { Route as logout } from "../../src/routes/auth/logout";

type AnyRoute = { options: { server?: { middleware?: readonly unknown[]; handlers?: Record<string, unknown> } } };
type Middleware = { options: { middleware?: readonly Middleware[]; server?: (opts: unknown) => unknown } };

const ROUTES: readonly [RegExp, AnyRoute, readonly string[]][] = [
  [/^\/auth\/login$/, login as AnyRoute, []],
  [/^\/auth\/callback$/, callback as AnyRoute, []],
  [/^\/auth\/logout$/, logout as AnyRoute, []],
  [/^\/api\/workspace$/, workspace as AnyRoute, []],
  [/^\/api\/repos$/, repos as AnyRoute, []],
  [/^\/api\/tasks$/, tasks as AnyRoute, []],
  [/^\/api\/tasks\/([^/]+)\/end$/, taskEnd as AnyRoute, ["id"]],
  [/^\/api\/tasks\/([^/]+)$/, task as AnyRoute, ["id"]],
  [/^\/api\/agent\/sessions\/([^/]+)\/([^/]+)$/, proxy as AnyRoute, ["id", "action"]],
  [/^\/api\/(.*)$/, catchAll as AnyRoute, ["_splat"]],
];

function flatten(middlewares: readonly Middleware[]): Middleware[] {
  const seen = new Set<Middleware>();
  const out: Middleware[] = [];
  const visit = (list: readonly Middleware[]) => {
    for (const m of list) {
      if (seen.has(m)) continue;
      seen.add(m);
      visit(m.options.middleware ?? []);
      out.push(m);
    }
  };
  visit(middlewares);
  return out;
}

export async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const found = ROUTES.map(([pattern, route, names]) => ({ match: pattern.exec(url.pathname), route, names })).find(
    (entry) => entry.match,
  );
  if (!found?.match) return Response.json({ error: { code: "not_found", message: "No such route." } }, { status: 404 });
  const params = Object.fromEntries(found.names.map((name, index) => [name, found.match?.[index + 1] ?? ""]));
  const server = found.route.options.server ?? {};
  const handler = server.handlers?.[request.method.toUpperCase()] as
    | ((ctx: { request: Request; params: Record<string, string>; context: unknown; pathname: string }) => unknown)
    | undefined;
  if (!handler) return Response.json({ error: { code: "not_found", message: "No such route." } }, { status: 404 });
  const chain = flatten((server.middleware ?? []) as readonly Middleware[]);
  let context: Record<string, unknown> = {};
  const run = async (index: number): Promise<Response> => {
    const middleware = chain[index];
    if (!middleware) {
      const result = await handler({ request, params, context, pathname: url.pathname });
      return result instanceof Response ? result : Response.json(result);
    }
    const fn = middleware.options.server;
    if (!fn) return run(index + 1);
    const result = (await fn({
      request,
      pathname: url.pathname,
      context,
      handlerType: "router",
      next: async (options?: { context?: Record<string, unknown> }) => {
        context = { ...context, ...(options?.context ?? {}) };
        return { request, pathname: url.pathname, context, response: await run(index + 1) };
      },
    })) as Response | { response: Response };
    return result instanceof Response ? result : result.response;
  };
  return run(0);
}
