import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryCategoryRow } from "@/lib/types/library-book";

interface RelatedCategoriesProps {
  categories: LibraryCategoryRow[];
}

export function RelatedCategories({ categories }: RelatedCategoriesProps) {
  const { t } = useLanguage();
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="related-categories-heading">
      <h2 id="related-categories-heading" className="mb-3 text-sm font-semibold">{t("library.categoryDetails.relatedCategories")}</h2>
      <div className="flex flex-wrap gap-2" role="list">
        {categories.map((category) => {
          const Icon = (category.icon && (Icons as unknown as Record<string, Icons.LucideIcon>)[category.icon]) || Icons.Library;
          return (
            <Link
              key={category.id}
              to={`/library/categories/${category.slug}`}
              role="listitem"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {category.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
