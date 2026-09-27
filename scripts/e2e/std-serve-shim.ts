// The harness's stand-in for std's http/server.ts `serve`: hands the function's
// handler to the harness instead of listening on a port.
type Handler = (req: Request) => Response | Promise<Response>;
export function serve(handler: Handler, _options?: unknown): Promise<void> {
  (globalThis as { __e2eServe?: (h: Handler) => void }).__e2eServe?.(handler);
  return Promise.resolve();
}
