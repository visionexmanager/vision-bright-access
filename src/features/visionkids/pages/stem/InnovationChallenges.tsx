import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useInnovationChallenges } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";

export default function InnovationChallenges() {
  const { t } = useLanguage();
  const { data: challenges = [], isLoading } = useInnovationChallenges();

  useDocumentHead({
    title: `${t("kids.stem.nav.innovation")} — VisionKids`,
    description: t("kids.stem.innovation.subtitle"),
    canonicalPath: "/kids/stem/innovation",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <StemHeader emoji="💡" title={t("kids.stem.nav.innovation")} subtitle={t("kids.stem.innovation.subtitle")} />

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : challenges.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.stem.innovation.none")}</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {challenges.map((c) => (
            <Link key={c.id} to={`/kids/stem/innovation/${c.slug}`}
              className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-transform hover:scale-[1.02] hover:border-kids-primary/50">
              <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
              <p className="font-heading text-lg font-bold leading-tight">{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.problem}</p>
              <span className="mt-auto pt-1 text-sm font-semibold text-kids-primary">{t("kids.stem.innovation.start")} →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
