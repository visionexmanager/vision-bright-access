import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * src/integrations/supabase/types.ts is auto-generated from the LIVE schema
 * and doesn't know about the kids_* tables yet — it's regenerated post-deploy,
 * the same two-step (migration, then typegen) flow already used for every
 * other Library/Academy migration in this repo (see that file's own header
 * comment, and the "regenerate stale Supabase types" commit in history).
 *
 * This narrows away the generated Database type ONLY for story queries so
 * `.from("kids_stories")` type-checks now. Every table/column is still
 * hand-typed via `.returns<T>()` on each call (see stories.types.ts), so
 * callers keep full type safety — this file is the one place that loses it.
 */
export const kidsDb = supabase as unknown as SupabaseClient;
