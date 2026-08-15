import { useId, useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Coins,
  MessageCircleQuestion,
  ShieldAlert,
  Target,
  Volume2,
} from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";
import { AnimatedSection } from "@/components/AnimatedSection";
import { scaleFade } from "@/components/animationVariants";

import { getServiceEntry, entriesForHub } from "@/features/servicecenter/catalog";
import { HUB_ACCENT_CLASSES, getHub } from "@/features/servicecenter/hubs";
import { getPersona } from "@/features/servicecenter/personas";
import { getAudioAsset, isPlayable } from "@/features/servicecenter/serviceAudio";
import { pick, pickList } from "@/features/servicecenter/components/localized";
import { DifficultyMeter } from "@/features/servicecenter/components/DifficultyMeter";
import { FeasibilityPanel } from "@/features/servicecenter/components/FeasibilityPanel";
import { ServiceCard } from "@/features/servicecenter/components/ServiceCard";
import { useServiceProgress } from "@/features/servicecenter/useServiceProgress";

/**
 * The service profile — the page that turns "43 Start buttons" into a decision.
 *
 * A visitor sees what they will learn, what it costs, how hard it is, who is
 * hosting it and (for business experiences) whether the venture even works,
 * before they spend a single VX.
 */
export default function ServiceProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const { playSound } = useSound();
  const uid = useId();
  const { completedSlugs } = useServiceProgress();

  const entry = getServiceEntry(slug);

  const related = useMemo(
    () =>
      entry
        ? entriesForHub(entry.hub)
            .filter((item) => item.slug !== entry.slug)
            .slice(0, 3)
        : [],
    [entry]
  );

  if (!entry) return <Navigate to="/services" replace />;

  const hub = getHub(entry.hub);
  const accent = HUB_ACCENT_CLASSES[hub?.accent ?? "sky"];
  const persona = getPersona(entry.persona?.id);
  const completed = completedSlugs.includes(entry.slug);

  const title = pick(entry.title, lang);
  const outcomes = pickList(entry.outcomes, lang);
  const skills = pickList(entry.skills, lang);

  const priceLabel =
    entry.vx === 0
      ? t("sc.free")
      : entry.usageBased
        ? t("sc.fromPerSession").replace("{price}", formatVX(entry.vx))
        : formatVX(entry.vx);

  const ctaKey =
    entry.kind === "service"
      ? "sc.cta.request"
      : entry.kind === "advisor"
        ? "sc.cta.consult"
        : entry.kind === "tool" || entry.kind === "studio"
          ? "sc.cta.open"
          : completed
            ? "sc.cta.replay"
            : "sc.cta.start";

  // Ambience is announced only when a real, licensed asset exists — see
  // serviceAudio.ts. We never advertise sound the platform cannot play.
  const ambience = entry.audio ? getAudioAsset(entry.audio.ambience) : undefined;
  const ambienceReady = isPlayable(ambience);

  return (
    <Layout>
      <article className="section-container py-8" aria-labelledby={`${uid}-title`}>
        <Link
          to="/services"
          onClick={() => playSound("navigate")}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("sc.backToCenter")}
        </Link>

        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative overflow-hidden rounded-2xl">
            {entry.image ? (
              <img
                src={entry.image}
                alt=""
                role="presentation"
                className="h-56 w-full object-cover sm:h-72"
              />
            ) : (
              <div
                className={`h-56 w-full bg-gradient-to-br sm:h-72 ${accent.gradient}`}
                aria-hidden="true"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6">
              {hub && (
                <Link
                  to="/services"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${accent.chip}`}
                >
                  {pick(hub.title, lang)}
                </Link>
              )}
              <h1 id={`${uid}-title`} className="mt-2 type-heading text-foreground">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-base text-muted-foreground sm:text-lg">
                {pick(entry.tagline, lang)}
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* Key facts + CTA */}
        <AnimatedSection className="mt-6">
          <Card>
            <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
              <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("sc.level.label")}</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    <DifficultyMeter difficulty={entry.difficulty} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("sc.duration")}</dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {entry.durationMinutes > 0
                      ? t("sc.minutes").replace("{n}", String(entry.durationMinutes))
                      : t("sc.selfPaced")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("sc.cost")}</dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    {priceLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("sc.status")}</dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {completed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        {t("sc.completed")}
                      </>
                    ) : (
                      t("sc.notStarted")
                    )}
                  </dd>
                </div>
              </dl>

              <Button asChild size="lg" className="shrink-0">
                <Link to={entry.to} onClick={() => playSound("navigate")}>
                  {t(ctaKey)}
                  <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </AnimatedSection>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Outcomes */}
            {outcomes.length > 0 && (
              <AnimatedSection>
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <Target className={`h-5 w-5 ${accent.text}`} aria-hidden="true" />
                      {t("sc.outcomes.title")}
                    </h2>
                    <ul className="mt-3 space-y-2.5">
                      {outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2.5 text-sm text-foreground">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>
            )}

            {/* Feasibility */}
            {entry.feasibility && (
              <AnimatedSection>
                <FeasibilityPanel input={entry.feasibility} />
              </AnimatedSection>
            )}

            {/* Persona */}
            {persona && (
              <AnimatedSection>
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <span
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl ${accent.chip}`}
                        aria-hidden="true"
                      >
                        {persona.avatarEmoji}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-foreground">
                          {pick(persona.name, lang)}
                        </h2>
                        <p className={`text-sm font-medium ${accent.text}`}>
                          {pick(entry.persona?.role ?? persona.role, lang)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          “{pick(persona.greeting, lang)}”
                        </p>
                      </div>
                    </div>

                    <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                      {t("sc.persona.asks")}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {pickList(persona.openingQuestions, lang).map((question) => (
                        <li key={question} className="text-sm text-muted-foreground">
                          — {question}
                        </li>
                      ))}
                    </ul>

                    {persona.handoff && (
                      <p
                        role="note"
                        className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
                      >
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {pick(persona.handoff, lang)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </AnimatedSection>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {skills.length > 0 && (
              <AnimatedSection>
                <Card>
                  <CardContent className="p-5">
                    <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                      <BadgeCheck className={`h-4 w-4 ${accent.text}`} aria-hidden="true" />
                      {t("sc.skills.title")}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">{t("sc.skills.desc")}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <li
                          key={skill}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${accent.chip}`}
                        >
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>
            )}

            {ambienceReady && ambience && (
              <AnimatedSection>
                <Card>
                  <CardContent className="p-5">
                    <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                      <Volume2 className={`h-4 w-4 ${accent.text}`} aria-hidden="true" />
                      {t("sc.audio.title")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pick(ambience.brief, lang)}
                    </p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            )}

            {related.length > 0 && (
              <AnimatedSection>
                <h2 className="mb-3 text-base font-bold text-foreground">{t("sc.related.title")}</h2>
                <div className="space-y-4" role="list">
                  {related.map((item) => (
                    <div key={item.slug} role="listitem">
                      <ServiceCard entry={item} completed={completedSlugs.includes(item.slug)} />
                    </div>
                  ))}
                </div>
              </AnimatedSection>
            )}
          </div>
        </div>
      </article>
    </Layout>
  );
}
