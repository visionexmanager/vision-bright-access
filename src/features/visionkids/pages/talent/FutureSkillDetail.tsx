import { Link, useParams, Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useFutureSkill, useTalentTrack } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

export default function FutureSkillDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { data: skill, isLoading } = useFutureSkill(slug);
  const { data: track } = useTalentTrack(skill?.related_track ?? undefined);

  useDocumentHead({
    title: skill ? `${skill.title} — VisionKids` : t("kids.talent.nav.futureSkills"),
    description: skill?.description ?? t("kids.talent.futureSkills.subtitle"),
    canonicalPath: `/kids/talent/future-skills/${slug ?? ""}`,
  });

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-64 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!skill) return <Navigate to="/kids/talent/future-skills" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <TalentHeader emoji={skill.emoji} title={skill.title} subtitle={skill.description ?? undefined} />

      {skill.why_it_matters && (
        <section className="mt-6 rounded-2xl border-2 border-kids-primary/30 bg-kids-primary/5 p-5">
          <h2 className="font-heading text-lg font-bold">💡 {t("kids.talent.futureSkills.whyTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{skill.why_it_matters}</p>
        </section>
      )}

      {track && (
        <section className="mt-6">
          <h2 className="font-heading text-lg font-bold">🎓 {t("kids.talent.futureSkills.startLearning")}</h2>
          <Link
            to={`/kids/talent/track/${track.slug}`}
            className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-transform hover:scale-[1.01]"
          >
            <span className="text-3xl" aria-hidden="true">{track.emoji}</span>
            <div>
              <p className="font-heading font-bold">{track.title}</p>
              {track.description && <p className="text-sm text-muted-foreground">{track.description}</p>}
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
