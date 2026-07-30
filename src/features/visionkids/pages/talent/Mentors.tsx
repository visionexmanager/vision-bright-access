import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMentors, useTalentTracks } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { useMyMentorRequests, useRequestMentor, useCancelMentorRequest } from "@/features/visionkids/hooks/talent/useMentors";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

export default function Mentors() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: mentors = [], isLoading } = useMentors();
  const { data: tracks = [] } = useTalentTracks();
  const { data: requests = [] } = useMyMentorRequests();
  const request = useRequestMentor();
  const cancel = useCancelMentorRequest();

  useDocumentHead({
    title: `${t("kids.talent.nav.mentors")} — VisionKids`,
    description: t("kids.talent.mentors.subtitle"),
    canonicalPath: "/kids/talent/mentors",
  });

  const requestBySlug = new Map(requests.map((r) => [r.mentor_slug, r]));
  const trackTitle = (s: string) => tracks.find((tr) => tr.slug === s)?.title ?? s;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="🧑‍🏫" title={t("kids.talent.nav.mentors")} subtitle={t("kids.talent.mentors.subtitle")} showSubNav activeId="mentors" />

      <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="status">
        ℹ️ {t("kids.talent.mentors.comingSoon")}
      </p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mentors.map((m) => {
            const req = requestBySlug.get(m.slug);
            return (
              <li key={m.slug} className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-kids-primary/10 text-2xl" aria-hidden="true">{m.emoji}</span>
                  <div>
                    <p className="font-heading font-bold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.title}</p>
                  </div>
                </div>
                {m.bio && <p className="text-sm text-muted-foreground">{m.bio}</p>}
                {m.related_tracks.length > 0 && (
                  <p className="text-xs text-muted-foreground">🎓 {m.related_tracks.map(trackTitle).join("، ")}</p>
                )}
                <div className="mt-auto pt-1">
                  {req ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border-2 border-kids-primary/40 bg-kids-primary/10 px-3 py-1 text-xs font-semibold text-kids-primary">
                        {t(`kids.talent.mentors.status.${req.status}`)}
                      </span>
                      <button type="button" onClick={() => cancel.mutate(req.id)} className="text-xs text-muted-foreground hover:underline">
                        {t("kids.talent.mentors.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => request.mutate({ mentorSlug: m.slug })}
                      disabled={!user || request.isPending}
                      className="rounded-full border-2 border-border px-4 py-1.5 text-sm font-semibold hover:border-kids-primary/50 disabled:opacity-50"
                    >
                      {t("kids.talent.mentors.request")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!user && <p className="mt-3 text-sm text-muted-foreground" role="status">{t("kids.talent.mentors.signInHint")}</p>}
    </div>
  );
}
