import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Shared header for STEM Center sub-pages: back-to-hub link, emoji + title +
 *  subtitle. Mirrors WellnessHeader / TalentHeader. */
export function StemHeader({
  emoji,
  title,
  subtitle,
  backTo = "/kids/stem",
  backLabelKey = "kids.stem.heroTitle",
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabelKey?: string;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(backLabelKey)}
      </Link>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
        <span aria-hidden="true">{emoji}</span> {title}
      </h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
