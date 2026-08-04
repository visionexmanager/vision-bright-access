/**
 * `kidsDb` used to be `supabase as unknown as SupabaseClient` — a cast that
 * erased the generated Database type, written when
 * src/integrations/supabase/types.ts predated the kids_* migrations and
 * `.from("kids_stories")` would not type-check at all.
 *
 * That file has since been regenerated from the live schema and knows every
 * kids_* table, so the cast is not just unnecessary — it was actively harmful.
 * An untyped SupabaseClient resolves its Database generic to `any`, which made
 * every `.maybeSingle().returns<T>()` in these services collapse into the
 * "Cannot cast array result to a single object" error type.
 *
 * The alias stays so existing imports keep working and the intent stays named.
 * Do not reintroduce the cast: if a kids_* table stops type-checking, the
 * generated types have drifted again — run
 * .github/workflows/supabase-types.yml rather than casting around it.
 */
export { supabase as kidsDb } from "@/integrations/supabase/client";

import type { Json } from "@/integrations/supabase/types";

/**
 * Unwraps the result of a Postgres function that returns `json`.
 *
 * `.rpc()` types such a result as the whole `Json` union, so narrowing it to
 * the shape the SQL function actually returns is an assertion TypeScript
 * cannot check — the contract lives in the migration, not in the type system.
 * Naming that assertion once keeps it greppable and stops it from being
 * mistaken for an ordinary cast; a plain `data as T` does not even compile,
 * because `Json` and a concrete object type do not overlap.
 *
 * This is only for `json`-returning functions. An RPC that returns a table
 * row is typed correctly on its own and needs nothing.
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
export function jsonPayload(value: Record<string, unknown>): Json {
  return value as Json;
}
