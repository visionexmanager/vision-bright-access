import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Radio, Search, ChevronLeft, ChevronRight, RefreshCw, Lock } from "lucide-react";
import { useRadioSubscription } from "@/hooks/useRadioSubscription";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/contexts/AuthContext";
import { StationCard } from "@/components/radio/StationCard";
import { detectType } from "@/components/OfficialStreamPlayer";
import { RadioSubscriptionStatus } from "@/components/radio/RadioSubscriptionStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { RadioStation } from "@/hooks/useRadioSubscription";

export default function LiveRadio() {
  const navigate = useNavigate();
  const { t, dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { user, loading: authLoading } = useAuth();

  const {
    subscription, isSubscribed, daysRemaining,
    stations, genres, isLoading,
  } = useRadioSubscription();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const displayDays = subscription ? daysRemaining : (isOnTrial ? trialDaysLeft : 0);

  const [query,      setQuery]      = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = stations;
    if (activeSlug !== "all") list = list.filter(s => s.genre?.slug === activeSlug);
    if (query.trim()) list = list.filter(s =>
      s.name_ar.includes(query) || s.name.toLowerCase().includes(query.toLowerCase())
    );
    return list;
  }, [stations, activeSlug, query]);

  const handleStationClick = (station: RadioStation) => {
    const urlType = detectType(station.official_url ?? "");
    if (urlType === "external" && station.official_url) {
      window.open(station.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-radio/listen/${station.id}`);
    }
  };

  const genreLabel = (g: { name: string; name_ar: string }) =>
    isRTL ? g.name_ar : g.name;

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Layout>
      <main aria-labelledby="liveradio-heading" className="max-w-7xl mx-auto px-4 py-12 space-y-8" dir={dir}>

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-l from-orange-900/80 via-orange-800/50 to-slate-900 p-8 border border-orange-500/20">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-xl border border-orange-400/30" aria-hidden="true">
                  <Radio className="w-7 h-7 text-orange-400" />
                </div>
                <h1 id="liveradio-heading" className="text-3xl font-extrabold text-white">VisionEx Radio</h1>
              </div>
              <p className="text-orange-200/80 text-sm max-w-xs">
                {t("liveRadio.heroDesc")}
              </p>
              <RadioSubscriptionStatus
                subscription={subscription}
                isSubscribed={isSubscribed}
                daysRemaining={daysRemaining}
                className="mt-1"
              />
            </div>

            {isSubscribed ? (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-sm px-4 py-2">
                ✓ {isOnTrial && !subscription ? t("home.highlight.trial") : t("liveRadio.activeSubscription")} · {displayDays} {t(displayDays === 1 ? "liveRadio.day" : "liveRadio.days")}
              </Badge>
            ) : (
              <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-400 text-white font-bold shadow-lg shadow-orange-500/30">
                <Link to="/services/live-radio/subscribe">
                  {t("liveRadio.subscribeNow")}
                  <ChevronIcon className="w-5 h-5 ms-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div role="search" className="relative max-w-md">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} aria-hidden="true" />
          <Input
            id="liveradioSearch"
            aria-label={t("liveRadio.searchPlaceholder")}
            placeholder={t("liveRadio.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={isRTL ? "pr-9" : "pl-9"}
            dir={dir}
          />
        </div>

        {/* Genre tabs */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("liveRadio.stationList")}>
          <button
            onClick={() => setActiveSlug("all")}
            aria-pressed={activeSlug === "all"}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              activeSlug === "all"
                ? "bg-orange-500 text-white border-orange-500"
                : "border-border text-muted-foreground hover:border-orange-400/40 hover:text-foreground"
            )}
          >
            {t("liveRadio.all")} ({stations.length})
          </button>
          {genres.map(genre => {
            const count = stations.filter(s => s.genre?.slug === genre.slug).length;
            return (
              <button
                key={genre.id}
                onClick={() => setActiveSlug(genre.slug)}
                aria-pressed={activeSlug === genre.slug}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeSlug === genre.slug
                    ? "bg-orange-500 text-white border-orange-500"
                    : "border-border text-muted-foreground hover:border-orange-400/40 hover:text-foreground"
                )}
              >
                {genreLabel(genre)} ({count})
              </button>
            );
          })}
        </div>

        {/* Station grid */}
        {authLoading || isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground" role="status" aria-live="polite">
            <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
            {t("liveRadio.loading")}
          </div>
        ) : !user ? (
          <div className="text-center py-16 text-muted-foreground">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t("liveRadio.loginToView")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t("liveRadio.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" role="list" aria-label={t("liveRadio.stationList")}>
            {filtered.map(st => (
              <div key={st.id} role="listitem">
                <StationCard
                  station={st}
                  isSubscribed={isSubscribed}
                  onClick={handleStationClick}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
