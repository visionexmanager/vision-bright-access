import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tv, Search, Lock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/contexts/AuthContext";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { detectType } from "@/components/OfficialStreamPlayer";
import { TVSubscriptionStatus } from "@/components/tv/TVSubscriptionStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

export default function LiveTV() {
  const navigate = useNavigate();
  const { t, dir, lang } = useLanguage();
  const isRTL = dir === "rtl";
  const { user, loading: authLoading } = useAuth();

  const {
    subscription, isSubscribed, daysRemaining,
    channels, categories, isLoading,
  } = useTVSubscription();
  const { isOnTrial, trialDaysLeft } = useTrial();
  // Show trial days when no paid subscription
  const displayDays = subscription ? daysRemaining : (isOnTrial ? trialDaysLeft : 0);

  const [query,      setQuery]      = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = channels;
    if (activeSlug !== "all") list = list.filter(ch => ch.category?.slug === activeSlug);
    if (query.trim()) list = list.filter(ch =>
      ch.name_ar.includes(query) || ch.name.toLowerCase().includes(query.toLowerCase())
    );
    return list;
  }, [channels, activeSlug, query]);

  const handleChannelClick = (channel: TVChannel) => {
    const urlType = detectType(channel.official_url ?? "");
    if (urlType === "external" && channel.official_url) {
      window.open(channel.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-tv/watch/${channel.id}`);
    }
  };

  const catLabel = (cat: { name: string; name_ar: string }) =>
    isRTL ? cat.name_ar : cat.name;

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Layout>
      <main aria-labelledby="livetv-heading" className="max-w-7xl mx-auto px-4 py-12 space-y-8" dir={dir}>

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-l from-blue-900/80 via-blue-800/60 to-slate-900 p-8 border border-blue-500/20">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30" aria-hidden="true">
                  <Tv className="w-7 h-7 text-blue-400" />
                </div>
                <h1 id="livetv-heading" className="text-3xl font-extrabold text-white">VisionEx TV</h1>
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
                ✓ {isOnTrial && !subscription ? t("home.highlight.trial") : t("liveTV.activeSubscription")} · {displayDays} {t(displayDays === 1 ? "liveTV.day" : "liveTV.days")}
              </Badge>
            ) : (
              <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-400 text-white font-bold shadow-lg shadow-blue-500/30">
                <Link to="/services/live-tv/subscribe">
                  {t("liveTV.subscribeNow")}
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
            id="livetvSearch"
            aria-label={t("liveTV.searchPlaceholder")}
            placeholder={t("liveTV.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={isRTL ? "pr-9" : "pl-9"}
            dir={dir}
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("liveTV.channelList")}>
          <button
            onClick={() => setActiveSlug("all")}
            aria-pressed={activeSlug === "all"}
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
                aria-pressed={activeSlug === cat.slug}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeSlug === cat.slug
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-border text-muted-foreground hover:border-blue-400/40 hover:text-foreground"
                )}
              >
                {catLabel(cat)} ({count})
              </button>
            );
          })}
        </div>

        {/* Channel grid */}
        {authLoading || isLoading ? (
          // Auth or data still loading — show spinner, never show empty state
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground" role="status" aria-live="polite">
            <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
            {t("liveTV.loading")}
          </div>
        ) : !user ? (
          // Definitely not logged in
          <div className="text-center py-16 text-muted-foreground">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t("liveTV.loginToView")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t("liveTV.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" role="list" aria-label={t("liveTV.channelList")}>
            {filtered.map(ch => (
              <div key={ch.id} role="listitem">
              <ChannelCard
                channel={ch}
                isSubscribed={isSubscribed}
                onClick={handleChannelClick}
              />
              </div>
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
