import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Calendar, Users, Trophy, Radio, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useEventBySlug } from "@/features/visionkids/hooks/events/useEvents";
import { useAttendanceCount } from "@/features/visionkids/hooks/events/useAttendance";
import { useEventMedals } from "@/features/visionkids/hooks/events/useRewards";
import { useReplayByEventId } from "@/features/visionkids/hooks/events/useReplay";
import { RegistrationButton } from "@/features/visionkids/components/events/RegistrationButton";

export default function EventDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  const { data: event, isLoading } = useEventBySlug(slug);
  const { data: attendanceCount = 0 } = useAttendanceCount(event?.id);
  const { data: medals = [] } = useEventMedals(event?.id);
  const { data: replay } = useReplayByEventId(event?.id);

  useDocumentHead({
    title: event ? `${event.title} — VisionKids` : t("kids.events.meta.title"),
    description: event?.description ?? t("kids.events.meta.description"),
    canonicalPath: `/kids/events/detail/${slug}`,
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!event) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.events.notFound")}</p>
        <Link to="/kids/events" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/kids/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.heroTitle")}
      </Link>

      <motion.div variants={slideUp(reduced)} className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-kids-primary/20 to-kids-purple/20 text-5xl">
          <span aria-hidden="true">{event.emoji}</span>
        </div>
        <div>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{event.title}</h1>
          {event.description && <p className="mt-1 text-muted-foreground">{event.description}</p>}
        </div>
      </motion.div>

      <motion.div variants={fadeIn(reduced)} className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" aria-hidden="true" /> {new Date(event.starts_at).toLocaleString()}</span>
        <span className="flex items-center gap-1"><Users className="h-4 w-4" aria-hidden="true" /> {attendanceCount}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{event.age_group === "all" ? t("kids.events.calendar.allAges") : event.age_group}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold capitalize">{t(`kids.events.level.${event.level}`)}</span>
      </motion.div>

      <motion.div variants={fadeIn(reduced)} className="mt-6">
        <RegistrationButton eventId={event.id} />
      </motion.div>

      {event.status === "live" && (
        <motion.div variants={fadeIn(reduced)} className="mt-6 flex items-center justify-between rounded-2xl border-2 border-kids-pink/40 bg-kids-pink/10 p-4">
          <span className="flex items-center gap-2 font-heading font-bold text-kids-pink"><Radio className="h-5 w-5 animate-pulse" aria-hidden="true" /> {t("kids.events.liveNow")}</span>
          <Button asChild className="bg-kids-pink text-white hover:bg-kids-pink/90">
            <Link to={`/kids/events/room/${event.slug}`}>{t("kids.events.joinLive")}</Link>
          </Button>
        </motion.div>
      )}

      {event.event_type === "competition" && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <Button asChild variant="outline" className="gap-1.5">
            <Link to={`/kids/events/detail/${slug}/register`}><Trophy className="h-4 w-4" aria-hidden="true" /> {t("kids.events.viewSubmissions")}</Link>
          </Button>
        </motion.div>
      )}

      {replay && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <Button asChild variant="outline" className="gap-1.5">
            <Link to={`/kids/events/replays/${replay.id}`}><PlayCircle className="h-4 w-4" aria-hidden="true" /> {t("kids.events.watchReplay")}</Link>
          </Button>
        </motion.div>
      )}

      {medals.length > 0 && (
        <motion.div variants={fadeIn(reduced)} className="mt-6">
          <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.events.rewards.medals")}</h2>
          <p className="text-sm text-muted-foreground">{medals.length} {t("kids.events.rewards.medalsAwarded")}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
