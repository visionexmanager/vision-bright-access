import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useResearchArticles } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { useReadArticleIds } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { STEM_COLOR_CLASSES } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";

export default function ResearchCenter() {
  const { t } = useLanguage();
  const [category, setCategory] = useState("all");
  const { data: articles = [], isLoading } = useResearchArticles();
  const { data: readIds = [] } = useReadArticleIds();

  useDocumentHead({
    title: `${t("kids.stem.nav.research")} — VisionKids`,
    description: t("kids.stem.research.subtitle"),
    canonicalPath: "/kids/stem/research",
  });

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category));
    return ["all", ...[...set].sort()];
  }, [articles]);
  const readSet = new Set(readIds);
  const visible = category === "all" ? articles : articles.filter((a) => a.category === category);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <StemHeader emoji="📚" title={t("kids.stem.nav.research")} subtitle={t("kids.stem.research.subtitle")} />

      {categories.length > 1 && (
        <nav aria-label={t("kids.stem.research.categories")} className="mt-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} aria-current={category === c ? "true" : undefined}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${category === c ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
              {c === "all" ? t("kids.stem.all") : c}
            </button>
          ))}
        </nav>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.stem.research.none")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((a) => (
            <Link key={a.id} to={`/kids/stem/research/${a.slug}`}
              className={`relative flex flex-col gap-2 rounded-2xl border-2 p-5 transition-transform hover:scale-[1.02] ${STEM_COLOR_CLASSES[a.color]}`}>
              {readSet.has(a.id) && <CheckCircle2 className="absolute end-3 top-3 h-5 w-5 text-kids-green" aria-label={t("kids.stem.research.read")} />}
              <span className="text-3xl" aria-hidden="true">{a.emoji}</span>
              <p className="font-heading text-base font-bold leading-tight">{a.title}</p>
              {a.summary && <p className="text-sm text-foreground/70">{a.summary}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
