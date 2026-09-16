// The one error shape every route returns and the browser reads:
// `{ error: { code, message } }`, the same envelope the OpenComputer
// management API uses, so one kind of failure covers the app's own answers
// and the ones it forwards.
export interface Problem {
  readonly error: { readonly code: string; readonly message: string };
}
