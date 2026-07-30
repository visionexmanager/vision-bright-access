import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCareers } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { TALENT_COLOR_CLASSES } from "@/features/visionkids/data/talentConfig";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

export default function CareerExplorer() {
  const { t } = useLanguage();
  const { data: careers = [], isLoading } = useCareers();

  useDocumentHead({
    title: `${t("kids.talent.nav.careers")} — VisionKids`,
    description: t("kids.talent.careers.subtitle"),
    canonicalPath: "/kids/talent/careers",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <TalentHeader emoji="🧑‍🚀" title={t("kids.talent.nav.careers")} subtitle={t("kids.talent.careers.subtitle")} showSubNav activeId="careers" />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {careers.map((c) => (
            <Link
              key={c.slug}
              to={`/kids/talent/careers/${c.slug}`}
              className={`flex flex-col gap-2 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.02] ${TALENT_COLOR_CLASSES[c.color]}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
                <p className="font-heading text-base font-bold leading-tight">{c.title}</p>
              </div>
              {c.description && <p className="text-sm text-foreground/70">{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
