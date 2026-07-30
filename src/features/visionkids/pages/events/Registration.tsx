import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Trophy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEventBySlug } from "@/features/visionkids/hooks/events/useEvents";
import { useMyRegistration } from "@/features/visionkids/hooks/events/useRegistration";
import { useSubmissions, useMySubmission, useSubmitEntry } from "@/features/visionkids/hooks/events/useRewards";
import { RegistrationButton } from "@/features/visionkids/components/events/RegistrationButton";

export default function Registration() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: event } = useEventBySlug(slug);
  const { data: registration } = useMyRegistration(event?.id);
  const isCompetition = event?.event_type === "competition";

  const { data: submissions = [] } = useSubmissions(isCompetition ? event?.id : undefined);
  const { data: mySubmission } = useMySubmission(isCompetition ? event?.id : undefined);
  const submitEntry = useSubmitEntry(event?.id);
  const [entryText, setEntryText] = useState("");

  useDocumentHead({ title: event ? `${event.title} — VisionKids` : t("kids.events.meta.title"), description: "", canonicalPath: `/kids/events/detail/${slug}/register` });

  if (!event) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to={`/kids/events/detail/${slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {event.title}
      </Link>

      <h1 className="font-heading text-2xl font-extrabold">{isCompetition ? t("kids.events.viewSubmissions") : t("kids.events.register")}</h1>

      <div className="mt-4">
        <RegistrationButton eventId={event.id} />
      </div>

      {registration?.parental_approval_status === "pending" && (
        <p className="mt-2 text-sm text-muted-foreground">{t("kids.events.parentalApprovalExplainer")}</p>
      )}

      {isCompetition && (
        <>
          <h2 className="mt-8 flex items-center gap-2 font-heading text-lg font-bold"><Trophy className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.events.competition.yourEntry")}</h2>
          {user ? (
            mySubmission ? (
              <div className="mt-2 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-4">
                <p className="text-sm">{mySubmission.content}</p>
                <p className="mt-1 text-xs font-semibold text-kids-green">{t("kids.events.competition.entrySubmitted")}</p>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <Textarea value={entryText} onChange={(e) => setEntryText(e.target.value)} placeholder={t("kids.events.competition.entryPlaceholder")} rows={4} />
                <Button className="gap-1.5 self-start" onClick={() => submitEntry.mutate({ content: entryText })} disabled={!entryText.trim() || submitEntry.isPending}>
                  <Upload className="h-4 w-4" aria-hidden="true" /> {t("kids.events.competition.submitEntry")}
                </Button>
              </div>
            )
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("kids.stories.signInRequired")}</p>
          )}

          <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.events.competition.allEntries")}</h2>
          <div className="mt-2 flex flex-col gap-2">
            {submissions.length === 0 && <p className="text-sm text-muted-foreground">{t("kids.events.competition.noEntriesYet")}</p>}
            {submissions.map((s) => (
              <div key={s.id} className="rounded-xl border-2 border-border bg-card p-3 text-sm">
                {s.content}
                {s.rank && <span className="ms-2 text-xs font-bold text-kids-accent">#{s.rank}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
