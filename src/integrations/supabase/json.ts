import type { Json } from "./types";

/**
 * Unwraps the result of a Postgres function that returns `json`.
 *
 * `.rpc()` types such a result as the whole `Json` union, so narrowing it to
 * the shape the function actually returns is an assertion TypeScript cannot
 * check — the contract lives in the migration, not in the type system. Naming
 * it once keeps it greppable and stops it reading as an ordinary cast; a plain
 * `data as T` does not even compile, because `Json` and a concrete object type
 * do not overlap.
 *
 * Only for `json`-returning functions. An RPC that returns a table row is
 * typed correctly on its own and needs nothing.
 */
export function rpcResult<T>(data: Json): T {
  return data as unknown as T;
}

/**
 * Passes an app-side payload into a `jsonb` column or RPC parameter.
 *
 * These payloads are declared `Record<string, unknown>` on the app side, which
 * is not assignable to `Json`: `unknown` could be a Date, a function, a Map —
 * things `Json` excludes and TypeScript cannot rule out. At runtime the values
 * really are JSON-serializable, since they came from or are headed for a jsonb
 * column, so the narrowing is sound; it just cannot be proven here.
 *
 * Named rather than inlined so the assumption is greppable, and so a payload
 * that genuinely is not serializable has one obvious place to be caught.
 */
export function jsonPayload(value: object): Json {
  return value as Json;
}
