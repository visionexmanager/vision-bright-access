import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedSection } from "@/components/AnimatedSection";
import { scaleFade } from "@/components/animationVariants";
import { WatchAdButton } from "@/components/WatchAdButton";
import { Input } from "@/components/ui/input";
import { Award, BadgeCheck, Briefcase, LayoutGrid, Search, TrendingUp } from "lucide-react";
import servicesImg from "@/assets/services-illustration.jpg";

import { HUBS } from "@/features/servicecenter/hubs";
import {
  SERVICE_CATALOG,
  entriesForHub,
  featuredEntries,
  hubCounts,
} from "@/features/servicecenter/catalog";
import { findServices } from "@/features/servicecenter/navigatorEngine";
import { ServiceNavigator } from "@/features/servicecenter/components/ServiceNavigator";
import { ServiceCard } from "@/features/servicecenter/components/ServiceCard";
import { HubCard } from "@/features/servicecenter/components/HubCard";
import { pick } from "@/features/servicecenter/components/localized";
import { useServiceProgress } from "@/features/servicecenter/useServiceProgress";
import { levelTitle } from "@/features/servicecenter/progress";
import type { HubId } from "@/features/servicecenter/types";

/**
 * Visionex Service Center.
 *
 * Replaces the previous flat list of every experience with an intent-first
 * entry point: the visitor says what they want to do, or picks one of six
 * hubs. Nothing links straight into a paid session — every card goes to a
 * profile page that explains cost, difficulty and outcome first.
 */
export default function ServiceCenter() {
  const { t, lang } = useLanguage();
  const { playSound } = useSound();
  const { user } = useAuth();
  const uid = useId();

  const { profile, completedSlugs, loading } = useServiceProgress();
  const [activeHub, setActiveHub] = useState<HubId | null>(null);
  const [search, setSearch] = useState("");

  const counts = useMemo(() => hubCounts(), []);
  const featured = useMemo(() => featuredEntries(), []);

  const completedByHub = useMemo(() => {
    const map = new Map<HubId, number>();
    for (const hub of profile.hubs) map.set(hub.hub, hub.completed);
    return map;
  }, [profile.hubs]);

  const searchResults = useMemo(() => {
    const query = search.trim();
    if (query.length < 2) return null;
    return findServices({ text: query, completedSlugs }, 12);
  }, [search, completedSlugs]);

  const hubEntries = useMemo(
    () => (activeHub ? entriesForHub(activeHub) : []),
    [activeHub]
  );

  const activeHubDef = HUBS.find((hub) => hub.id === activeHub);

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby={`${uid}-heading`}>
        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-6 overflow-hidden rounded-2xl">
            <img
              src={servicesImg}
              alt=""
              role="presentation"
              loading="lazy"
              className="h-48 w-full object-cover sm:h-56"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {t("sc.eyebrow")}
              </p>
              <h1 id={`${uid}-heading`} className="type-heading text-foreground">
                {t("sc.title")}
              </h1>
              <p className="mt-1 max-w-2xl text-base text-muted-foreground sm:text-lg">
                {t("sc.subtitle")}
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* Professional record — only meaningful once signed in */}
        {user && !loading && profile.completedCount > 0 && (
          <AnimatedSection className="mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden="true">
                  <Award className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("sc.record.level")
                      .replace("{level}", String(profile.level))
                      .replace("{title}", pick(levelTitle(profile.level), lang))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("sc.record.points").replace("{n}", profile.totalPoints.toLocaleString())}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {t("sc.record.completed")
                    .replace("{done}", String(profile.completedCount))
                    .replace("{total}", String(SERVICE_CATALOG.length))}
                </p>
              </div>

              {profile.certifiedSkills.length > 0 && (
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {t("sc.record.certified").replace(
                      "{n}",
                      String(profile.certifiedSkills.length)
                    )}
                  </p>
                </div>
              )}

              <Link
                to="/services/my-requests"
                onClick={() => playSound("navigate")}
                className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                {t("sc.orders.title")}
              </Link>
            </div>
          </AnimatedSection>
        )}

        {/* Navigator */}
        <AnimatedSection className="mb-8">
          <ServiceNavigator completedSlugs={completedSlugs} />
        </AnimatedSection>

        <WatchAdButton variant="card" className="mb-8" />

        {/* Search */}
        <AnimatedSection className="mb-8">
          <label htmlFor={`${uid}-search`} className="mb-1.5 block text-sm font-medium text-foreground">
            {t("sc.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`${uid}-search`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("sc.search.placeholder")}
              className="ps-9"
              aria-describedby={`${uid}-search-status`}
            />
          </div>

          <div id={`${uid}-search-status`} aria-live="polite" className="mt-4">
            {searchResults && (
              searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("sc.search.noResults")}</p>
              ) : (
                <>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    {t(
                      searchResults.length === 1 ? "sc.search.resultsOne" : "sc.search.results"
                    ).replace("{n}", String(searchResults.length))}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                    {searchResults.map((match) => (
                      <div key={match.entry.slug} role="listitem">
                        <ServiceCard
                          entry={match.entry}
                          completed={completedSlugs.includes(match.entry.slug)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>
        </AnimatedSection>

        {/* Hubs */}
        <AnimatedSection className="mb-8" aria-labelledby={`${uid}-hubs`}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id={`${uid}-hubs`} className="text-2xl font-bold text-foreground">
                {t("sc.hubs.title")}
              </h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">{t("sc.hubs.desc")}</p>
            </div>
            {activeHub && (
              <button
                type="button"
                onClick={() => {
                  setActiveHub(null);
                  playSound("click");
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                {t("sc.hubs.showAll")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {HUBS.map((hub) => (
              <div key={hub.id} role="listitem">
                <HubCard
                  hub={hub}
                  count={counts[hub.id] ?? 0}
                  completed={completedByHub.get(hub.id) ?? 0}
                  active={activeHub === hub.id}
                  onSelect={() => setActiveHub(activeHub === hub.id ? null : hub.id)}
                />
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Selected hub contents */}
        {activeHubDef && (
          <AnimatedSection className="mb-10" aria-labelledby={`${uid}-hub-entries`}>
            <div className="mb-5">
              <h2 id={`${uid}-hub-entries`} className="text-2xl font-bold text-foreground">
                {pick(activeHubDef.title, lang)}
              </h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                {pick(activeHubDef.description, lang)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {hubEntries.map((entry) => (
                <div key={entry.slug} role="listitem">
                  <ServiceCard entry={entry} completed={completedSlugs.includes(entry.slug)} />
                </div>
              ))}
            </div>
          </AnimatedSection>
        )}

        {/* Featured — only when the visitor has not narrowed things down */}
        {!activeHub && !searchResults && (
          <AnimatedSection className="mb-10" aria-labelledby={`${uid}-featured`}>
            <div className="mb-5">
              <h2 id={`${uid}-featured`} className="text-2xl font-bold text-foreground">
                {t("sc.featured.title")}
              </h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">{t("sc.featured.desc")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {featured.map((entry) => (
                <div key={entry.slug} role="listitem">
                  <ServiceCard entry={entry} completed={completedSlugs.includes(entry.slug)} />
                </div>
              ))}
            </div>
          </AnimatedSection>
        )}
      </section>
    </Layout>
  );
}
