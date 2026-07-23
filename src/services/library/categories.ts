// ─── Library — Category Details Service (Phase 4) ────────────────────────────
// Category detail, subcategories, related categories, and popular tags.
// Stats (author_count/total_views) go through the two SECURITY DEFINER RPCs
// added in 20260722000000_library_explorer_functions.sql — PostgREST can't
// express COUNT(DISTINCT)/SUM/GROUP BY through the query builder.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryCategoryRow, LibraryCategoryWithStats } from "@/lib/types/library-book";

const CATEGORY_SELECT = "id, parent_id, name, slug, description, icon, image_url, book_count";

export async function fetchCategoryBySlug(slug: string): Promise<LibraryCategoryRow | null> {
  const { data, error } = await supabase.from("library_categories").select(CATEGORY_SELECT).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function fetchSubcategories(parentId: string): Promise<LibraryCategoryRow[]> {
  const { data, error } = await supabase
    .from("library_categories")
    .select(CATEGORY_SELECT)
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface LibraryCategoryDetailStats {
  author_count: number;
  total_views: number;
}

export async function fetchCategoryStats(categoryId: string): Promise<LibraryCategoryDetailStats> {
  const { data, error } = await supabase.rpc("get_library_category_stats", { _category_id: categoryId });
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? { author_count: 0, total_views: 0 };
}

export async function fetchCategoriesWithStats(): Promise<LibraryCategoryWithStats[]> {
  const { data, error } = await supabase.rpc("get_library_categories_with_stats");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Sibling categories (same parent) if this category has a parent;
 *  otherwise its own subcategories, padded with a couple of other
 *  top-level categories if there aren't enough. */
export async function fetchRelatedCategories(category: LibraryCategoryRow, limit = 4): Promise<LibraryCategoryRow[]> {
  if (category.parent_id) {
    const { data, error } = await supabase
      .from("library_categories")
      .select(CATEGORY_SELECT)
      .eq("parent_id", category.parent_id)
      .eq("is_active", true)
      .neq("id", category.id)
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data: children, error: childrenErr } = await supabase
    .from("library_categories")
    .select(CATEGORY_SELECT)
    .eq("parent_id", category.id)
    .eq("is_active", true)
    .limit(limit);
  if (childrenErr) throw new Error(childrenErr.message);

  const related = children ?? [];
  if (related.length >= limit) return related;

  const { data: topLevel, error: topLevelErr } = await supabase
    .from("library_categories")
    .select(CATEGORY_SELECT)
    .is("parent_id", null)
    .eq("is_active", true)
    .neq("id", category.id)
    .limit(limit - related.length);
  if (topLevelErr) throw new Error(topLevelErr.message);

  return [...related, ...(topLevel ?? [])];
}

export interface LibraryPopularTag {
  tag_id: string;
  name: string;
  slug: string;
  usage_count: number;
}

export async function fetchPopularTags(limit = 12): Promise<LibraryPopularTag[]> {
  const { data, error } = await supabase
    .from("library_tag_popularity")
    .select("tag_id, name, slug, usage_count")
    .gt("usage_count", 0)
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
