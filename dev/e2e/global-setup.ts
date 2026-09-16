// Starts the fixture server for a replay run and stops it afterwards. On a
// live target (BASE_URL set) the configuration does not register this file.
import type { Server } from "node:http";
import { FIXTURE_PORT } from "./env";
import { fixtureApp, initialState, listen } from "./fixture-server";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server: Server = await listen(fixtureApp(initialState()), FIXTURE_PORT);
  return () =>
    new Promise((resolve, reject) => {
      server.close((cause) => (cause ? reject(cause) : resolve()));
    });
}
