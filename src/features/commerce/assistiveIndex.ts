import { assistiveCategories } from "@/data/assistiveProducts";

/**
 * Retrieval records derived from the assistive equipment reference.
 *
 * `src/data/assistiveProducts.ts` stays the single source of truth. The
 * Commerce Agent is a Deno edge function and cannot import from `src/`, so
 * this shape is snapshotted to JSON by
 * `scripts/generate-assistive-index.ts` and read from there — the same
 * decision already taken for the service catalogue.
 *
 * These are not listings. Nobody stocks them and nobody has quoted a price for
 * one today: they are researched equipment types with the price range the
 * market actually charges and the distributors who actually carry them. The
 * adapter reports them as needing sourcing confirmation for exactly that
 * reason, and reports no single price, because a range is what is known.
 */
export interface IndexedAssistiveProduct {
  id: string;
  category: string;
  title_en: string;
  title_ar: string;
  title_es: string;
  access_type: string;
  price_min_usd: number;
  price_max_usd: number;
  specs_en: string[];
  specs_ar: string[];
  /** One retrieval string covering every language, so any of them finds it. */
  text: string;
}

export function buildAssistiveIndex(): IndexedAssistiveProduct[] {
  return assistiveCategories.flatMap((category) =>
    category.products.map((product) => ({
      id: product.id,
      category: category.id,
      title_en: product.nameEn,
      title_ar: product.nameAr,
      title_es: product.nameEs,
      access_type: product.accessType,
      price_min_usd: product.priceMin,
      price_max_usd: product.priceMax,
      specs_en: product.specs.en,
      specs_ar: product.specs.ar,
      text: [
        product.nameEn,
        product.nameAr,
        product.nameEs,
        category.nameEn,
        category.nameAr,
        category.nameEs,
        ...product.specs.en,
        ...product.specs.ar,
      ]
        .filter(Boolean)
        .join(". "),
    })),
  );
}

export const ASSISTIVE_INDEX_PATH = "supabase/functions/_shared/data/assistiveCatalog.json";
