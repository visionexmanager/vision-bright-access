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

/**
 * Re-exported so these services keep a single import. The definitions live in
 * @/integrations/supabase/json because the library services need them too.
 */
export { rpcResult, jsonPayload } from "@/integrations/supabase/json";
