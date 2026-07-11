import { useLanguage } from "@/contexts/LanguageContext";
import { StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { CAREER_CATEGORIES } from "./mockCategories";

interface QuickCategoriesProps {
  onSelectCategory: (categoryId: string) => void;
}

export function QuickCategories({ onSelectCategory }: QuickCategoriesProps) {
  const { t } = useLanguage();

  return (
    <StaggerGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CAREER_CATEGORIES.map((category) => {
        const Icon = category.icon;
        return (
          <StaggerItem key={category.id}>
            <button
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">{t(category.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{category.jobCount.toLocaleString()} {t("careersPage.category.jobsSuffix")}</span>
            </button>
          </StaggerItem>
        );
      })}
    </StaggerGrid>
  );
}
