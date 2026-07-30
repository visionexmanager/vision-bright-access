import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useResearchArticle } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { useMarkResearchRead } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";

export default function ResearchArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: article, isLoading } = useResearchArticle(slug);
  const markRead = useMarkResearchRead();
  const marked = useRef(false);

  useDocumentHead({
    title: article ? `${article.title} — VisionKids` : t("kids.stem.nav.research"),
    description: article?.summary ?? t("kids.stem.research.subtitle"),
    canonicalPath: `/kids/stem/research/${slug}`,
  });

  // Mark read once (best-effort) when a signed-in child opens the article.
  useEffect(() => {
    if (user && article && !marked.current) {
      marked.current = true;
      markRead.mutate(article.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, article?.id]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!article) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <StemHeader emoji="📚" title={t("kids.stem.notFound")} backTo="/kids/stem/research" />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <StemHeader emoji={article.emoji} title={article.title} subtitle={article.summary ?? undefined}
        backTo="/kids/stem/research" backLabelKey="kids.stem.nav.research" />

      {article.images.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {article.images.map((img, i) => (
            <figure key={i} className="overflow-hidden rounded-2xl border-2 border-border">
              <img src={img.url} alt={img.caption ?? article.title} loading="lazy" className="h-40 w-full object-cover" />
              {img.caption && <figcaption className="p-2 text-xs text-muted-foreground">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {article.video_url && (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-border">
          <video controls preload="metadata" className="w-full" src={article.video_url} />
        </div>
      )}

      {article.body && <p className="mt-5 text-base leading-relaxed">{article.body}</p>}

      {article.fun_facts.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/5 p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Sparkles className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.stem.research.funFacts")}
          </h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
            {article.fun_facts.map((fact, i) => <li key={i}>{fact}</li>)}
          </ul>
        </section>
      )}

      {!user && <p className="mt-6 text-sm text-muted-foreground">{t("kids.stem.research.signInHint")}</p>}
    </div>
  );
}
