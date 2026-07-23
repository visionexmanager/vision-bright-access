import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryCategoryRow, LibraryCategoryWithStats } from "@/lib/types/library-book";

interface CategoryCardProps {
  category: LibraryCategoryRow | LibraryCategoryWithStats;
  subcategoryCount?: number;
}

function hasStats(category: CategoryCardProps["category"]): category is LibraryCategoryWithStats {
  return "author_count" in category;
}

export function CategoryCard({ category, subcategoryCount }: CategoryCardProps) {
  const { t, lang } = useLanguage();
  const Icon = (category.icon && (Icons as unknown as Record<string, Icons.LucideIcon>)[category.icon]) || Icons.Library;

  return (
    <Link to={`/library/categories/${category.slug}`} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="flex h-full flex-col items-start gap-3 overflow-hidden p-0 transition-shadow hover:shadow-md">
        {category.image_url ? (
          <img src={category.image_url} alt="" loading="lazy" className="h-24 w-full object-cover" />
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-primary/10 text-primary" aria-hidden="true">
            <Icon className="h-8 w-8" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 px-5 pb-5">
          <h3 className="font-semibold">{category.name}</h3>
          {category.description && <p className="text-xs text-muted-foreground">{category.description}</p>}
          {subcategoryCount ? (
            <p className="text-xs text-muted-foreground">{t("library.categories.subcategoryCount").replace("{count}", String(subcategoryCount))}</p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
            <span>{category.book_count} {t("library.categories.books")}</span>
            {hasStats(category) && (
              <>
                <span>{category.author_count} {t("library.categories.authors")}</span>
                <span>{t("library.categories.updated")}: {new Date(category.updated_at).toLocaleDateString(lang)}</span>
              </>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="mt-1 w-full">
            <span>{t("library.categories.browse")}</span>
          </Button>
        </div>
      </Card>
    </Link>
  );
}
