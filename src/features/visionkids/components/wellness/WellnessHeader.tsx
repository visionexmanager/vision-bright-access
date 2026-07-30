import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { WELLNESS_NAV } from "@/features/visionkids/data/wellnessConfig";

/** Shared header for Health Hub sub-pages: back-to-hub link, emoji + title +
 *  subtitle, and an optional chip sub-nav. Mirrors TalentHeader. */
export function WellnessHeader({
  emoji,
  title,
  subtitle,
  showSubNav = false,
  activeId,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  showSubNav?: boolean;
  activeId?: string;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <Link to="/kids/health" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t("kids.wellness.heroTitle")}
      </Link>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
        <span aria-hidden="true">{emoji}</span> {title}
      </h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}

      {showSubNav && (
        <nav aria-label={t("kids.wellness.heroTitle")} className="mt-4 flex flex-wrap gap-2">
          {WELLNESS_NAV.map((entry) => (
            <Link
              key={entry.id}
              to={entry.to}
              aria-current={activeId === entry.id ? "page" : undefined}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${
                activeId === entry.id
                  ? "border-kids-primary bg-kids-primary/10 text-kids-primary"
                  : "border-border hover:border-kids-primary/50"
              }`}
            >
              <span aria-hidden="true">{entry.emoji}</span> {t(entry.labelKey)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
