import { Link, useParams, Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCareer, useTalentDomains, useTalentTracks } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

export default function CareerDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { data: career, isLoading } = useCareer(slug);
  const { data: domains = [] } = useTalentDomains();
  const { data: tracks = [] } = useTalentTracks();

  useDocumentHead({
    title: career ? `${career.title} — VisionKids` : t("kids.talent.nav.careers"),
    description: career?.description ?? t("kids.talent.careers.subtitle"),
    canonicalPath: `/kids/talent/careers/${slug ?? ""}`,
  });

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-64 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!career) return <Navigate to="/kids/talent/careers" replace />;

  const domainMeta = (s: string) => domains.find((d) => d.slug === s);
  const relatedTracks = tracks.filter((tr) => career.related_tracks.includes(tr.slug));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <TalentHeader emoji={career.emoji} title={career.title} subtitle={career.description ?? undefined} />

      {career.a_day_like && (
        <section className="mt-6 rounded-2xl border-2 border-kids-primary/30 bg-kids-primary/5 p-5">
          <h2 className="font-heading text-lg font-bold">🗓️ {t("kids.talent.careers.aDayTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{career.a_day_like}</p>
        </section>
      )}

      {career.skill_domains.length > 0 && (
        <section className="mt-6">
          <h2 className="font-heading text-lg font-bold">🛠️ {t("kids.talent.careers.skillsTitle")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {career.skill_domains.map((s) => {
              const d = domainMeta(s);
              return (
                <li key={s} className="flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold">
                  <span aria-hidden="true">{d?.emoji ?? "⭐"}</span> {d?.title ?? s}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {relatedTracks.length > 0 && (
        <section className="mt-6">
          <h2 className="font-heading text-lg font-bold">🎓 {t("kids.talent.careers.tryTitle")}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {relatedTracks.map((tr) => (
              <Link key={tr.slug} to={`/kids/talent/track/${tr.slug}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                <span className="text-2xl" aria-hidden="true">{tr.emoji}</span>
                <span className="font-heading font-bold">{tr.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
