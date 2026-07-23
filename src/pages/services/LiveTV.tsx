/**
 * LiveTV — Main channel browser
 *
 * Layout:
 *  1. Hero bar with subscription status
 *  2. Section sub-navigation (Browse / Favorites / Search / Playlists)
 *  3. Featured channels (is_featured=true)
 *  4. Recently Watched row (from localStorage)
 *  5. Category filter pills
 *  6. Channel grid (inline search)
 */

import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tv, Search, Lock, ChevronLeft, ChevronRight,
  RefreshCw, Clock, Star, Clapperboard,
} from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/contexts/AuthContext";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { FavoriteButton } from "@/components/tv/FavoriteButton";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { TVSubscriptionStatus } from "@/components/tv/TVSubscriptionStatus";
import { detectType } from "@/components/OfficialStreamPlayer";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

// Maximum channels rendered without virtualization.
// Beyond this we still render all — virtualization lives in LiveTVWatch sidebar.
const GRID_PAGE_SIZE = 40;

export default function LiveTV() {
  const navigate     = useNavigate();
  const { t, dir }   = useLanguage();
  const isRTL        = dir === "rtl";
  const { user, loading: authLoading } = useAuth();

  const {
    subscription, isSubscribed, daysRemaining,
    channels, categories, isLoading, channelsError, refetchChannels,
  } = useTVSubscription();
  const { isOnTrial, trialDaysLeft } = useTrial();
  const { getHistory }               = useWatchHistory();

  const displayDays = subscription
    ? daysRemaining
    : isOnTrial ? trialDaysLeft : 0;

  // Read from localStorage once on mount — doesn't depend on channels
  const recentHistory = useMemo(() => getHistory().slice(0, 8), []); // eslint-disable-line react-hooks/exhaustive-deps
  const featured      = useMemo(() => channels.filter(c => c.is_featured).slice(0, 8), [channels]);

  const [query,      setQuery]      = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("all");
  const [gridLimit,  setGridLimit]  = useState(GRID_PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = channels;
    if (activeSlug !== "all") list = list.filter(ch => ch.category?.slug === activeSlug);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(ch =>
        ch.name.toLowerCase().includes(q) ||
        ch.name_ar.includes(query.trim()) ||
        ch.country?.toLowerCase().includes(q) ||
        ch.category?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [channels, activeSlug, query]);

  // Reset pagination when filter/search changes
  useEffect(() => { setGridLimit(GRID_PAGE_SIZE); }, [activeSlug, query]);

  const handleClick = (channel: TVChannel) => {
    const type = detectType(channel.official_url ?? "");
    if (type === "external" && channel.official_url) {
      window.open(channel.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-tv/watch/${channel.id}`);
    }
  };

  const catName  = (cat: { name: string; name_ar: string }) => isRTL ? cat.name_ar : cat.name;
  const chName   = (ch: TVChannel) => isRTL ? (ch.name_ar || ch.name) : (ch.name || ch.name_ar);
  const ChevIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir={dir}>

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-l from-blue-900/80 via-blue-800/60 to-slate-900 p-8 border border-blue-500/20">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <Tv className="w-7 h-7 text-blue-400" />
                </div>
                <h1 className="text-3xl font-extrabold text-white">VisionTV</h1>
              </div>
              <p className="text-blue-200/80 text-sm max-w-xs">
                {t("liveTV.heroDesc")}
              </p>
              <TVSubscriptionStatus
                subscription={subscription}
                isSubscribed={isSubscribed}
                daysRemaining={daysRemaining}
                className="mt-1"
              />
            </div>

            {isSubscribed ? (
              <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-sm px-4 py-2">
                ✓ {isOnTrial && !subscription ? t("home.highlight.trial") : t("liveTV.activeSubscription")}
                {" · "}{displayDays} {t(displayDays === 1 ? "liveTV.day" : "liveTV.days")}
              </Badge>
            ) : (
              <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-400 text-white font-bold shadow-lg shadow-blue-500/30">
                <Link to="/services/live-tv/subscribe">
                  {t("liveTV.subscribeNow")}
                  <ChevIcon className="w-5 h-5 ms-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Section nav ──────────────────────────────────── */}
        <TVSectionNav />

        {/* ── Movies & series guide ────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-card to-blue-500/10 p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="streaming-guide-heading">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-500" aria-hidden="true">
              <Clapperboard className="h-6 w-6" />
            </div>
            <div>
              <h2 id="streaming-guide-heading" className="font-bold text-foreground">
                {isRTL ? "أفلام ومسلسلات من مصادر رسمية" : "Movies and series from official sources"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isRTL
                  ? "دليل مرتب لمنصات المشاهدة القانونية، مع خيارات عربية وعالمية ورياضية."
                  : "A curated guide to legal streaming services, with Arabic, international, and sports options."}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/services/live-tv/streaming">
              {isRTL ? "افتح دليل المشاهدة" : "Open streaming guide"}
              <ChevIcon className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>

        {/* ── Featured channels ─────────────────────────────── */}
        {featured.length > 0 && !query && activeSlug === "all" && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <h2 className="font-bold text-sm text-foreground">
                {isRTL ? "قنوات مميزة" : "Featured Channels"}
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              {featured.map(ch => (
                <div key={ch.id} className="flex-shrink-0 group relative w-[140px] rounded-xl border border-border bg-card hover:border-blue-400/50 hover:shadow-md transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleClick(ch)}
                    aria-label={`${chName(ch)} — ${isRTL ? "تشغيل القناة المباشرة" : "Play live channel"}`}
                    className="block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  >
                    <div className="h-20 bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
                      {ch.logo_url
                        ? <img src={ch.logo_url} alt="" className="w-full h-full object-contain p-3" />
                        : <Tv className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                      }
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold truncate text-foreground">{chName(ch)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5" aria-hidden="true">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 me-1 align-middle animate-pulse" />
                        LIVE
                      </p>
                    </div>
                  </button>
                  <div className="absolute top-1 end-1">
                    <FavoriteButton channelId={ch.id} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recently Watched ──────────────────────────────── */}
        {recentHistory.length > 0 && !query && activeSlug === "all" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-bold text-sm text-foreground">
                  {isRTL ? "شاهدت مؤخراً" : "Recently Watched"}
                </h2>
              </div>
              <Link
                to="/services/live-tv/search"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isRTL ? "عرض الكل" : "See all"}
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              {recentHistory.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/services/live-tv/watch/${entry.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[56px] group"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border group-hover:border-blue-400/60 transition-colors flex items-center justify-center">
                    {entry.logo_url
                      ? <img src={entry.logo_url} alt={isRTL ? entry.name_ar : entry.name} className="w-full h-full object-contain p-1" />
                      : <Tv className="w-6 h-6 text-muted-foreground" />
                    }
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center truncate w-full">
                    {isRTL ? (entry.name_ar || entry.name) : (entry.name || entry.name_ar)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Inline search bar ─────────────────────────────── */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none",
              isRTL ? "right-3" : "left-3"
            )} />
            <Input
              aria-label={t("liveTV.searchPlaceholder")}
              placeholder={t("liveTV.searchPlaceholder")}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={isRTL ? "pr-9" : "pl-9"}
              dir={dir}
            />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/services/live-tv/search">
              <Search className="w-4 h-4 me-1.5" />
              {isRTL ? "بحث متقدم" : "Advanced"}
            </Link>
          </Button>
        </div>

        {/* ── Category pills ────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSlug("all")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              activeSlug === "all"
                ? "bg-blue-500 text-white border-blue-500"
                : "border-border text-muted-foreground hover:border-blue-400/40 hover:text-foreground"
            )}
          >
            {t("liveTV.all")} ({channels.length})
          </button>
          {categories.map(cat => {
            const count = channels.filter(c => c.category?.slug === cat.slug).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveSlug(cat.slug)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeSlug === cat.slug
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-border text-muted-foreground hover:border-blue-400/40 hover:text-foreground"
                )}
              >
                {catName(cat)} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Channel grid ─────────────────────────────────── */}
        {authLoading || isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            {t("liveTV.loading")}
          </div>
        ) : channelsError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-10 text-center">
            <Tv className="mx-auto mb-3 h-10 w-10 text-destructive" aria-hidden="true" />
            <p className="font-semibold text-foreground">
              {isRTL ? "تعذر تحميل القنوات حالياً" : "Channels could not be loaded"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRTL ? "تحقق من الاتصال ثم أعد المحاولة." : "Check your connection and try again."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => void refetchChannels()}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
              {t("player.retry")}
            </Button>
          </div>
        ) : !user ? (
          <div className="text-center py-16 text-muted-foreground">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("liveTV.loginToView")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("liveTV.noResults")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.slice(0, gridLimit).map(ch => (
                <div key={ch.id} className="relative">
                  <ChannelCard
                    channel={ch}
                    isSubscribed={isSubscribed}
                    onClick={handleClick}
                  />
                  <div className="absolute top-1.5 end-8">
                    <FavoriteButton channelId={ch.id} size="sm" />
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {filtered.length > gridLimit && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGridLimit(l => l + GRID_PAGE_SIZE)}
                >
                  {isRTL
                    ? `تحميل المزيد (${filtered.length - gridLimit} قناة)`
                    : `Load more (${filtered.length - gridLimit} channels)`
                  }
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
