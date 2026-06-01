import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tv, Search, Star, Lock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { TVSubscriptionStatus } from "@/components/tv/TVSubscriptionStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

export default function LiveTV() {
  const navigate = useNavigate();
  const { t, dir, lang } = useLanguage();
  const isRTL = dir === "rtl";

  const {
    subscription, isSubscribed, daysRemaining,
    channels, categories, isLoading,
  } = useTVSubscription();

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

  const featured = channels.filter(c => c.is_featured).slice(0, 6);

  const handleChannelClick = (channel: TVChannel) => {
    navigate(`/services/live-tv/watch/${channel.id}`);
  };

  const catLabel = (cat: { name: string; name_ar: string }) =>
    isRTL ? cat.name_ar : cat.name;

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8" dir={dir}>

        {/* Hero */}
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
                ✓ {t("liveTV.activeSubscription")} · {daysRemaining} {t(daysRemaining === 1 ? "liveTV.day" : "liveTV.days")}
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

        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <h2 className="font-bold text-lg text-foreground">{t("liveTV.featured")}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {featured.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-2 rounded-xl p-3 border transition-all hover:scale-105",
                    "border-border bg-card hover:border-blue-400/40 hover:shadow-md"
                  )}
                >
                  {ch.logo_url
                    ? <img src={ch.logo_url} alt={ch.name_ar} className="w-12 h-12 object-contain rounded-lg bg-muted p-0.5" />
                    : <Tv className="w-10 h-10 text-muted-foreground" />
                  }
                  <span className="text-xs font-medium text-center text-foreground line-clamp-2">
                    {isRTL ? ch.name_ar : ch.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
          <Input
            placeholder={t("liveTV.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={isRTL ? "pr-9" : "pl-9"}
            dir={dir}
          />
        </div>

        {/* Category tabs */}
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
                {catLabel(cat)} ({count})
              </button>
            );
          })}
        </div>

        {/* Channel grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            {t("liveTV.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("liveTV.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                isSubscribed={isSubscribed}
                onClick={handleChannelClick}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
