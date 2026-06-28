/**
 * LiveTVWatch — Channel player page
 *
 * Improvements over previous version:
 *  • Virtualized sidebar channel list (VirtualChannelList)
 *  • Favorites toggle button on current channel
 *  • Watch history recorded on channel load
 *  • Watch time reported silently to DB via useWatchReporter
 *  • Stream health badge in sidebar for channel reliability
 *  • Section sub-navigation
 */

import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LayoutGrid, Loader2 } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useLanguage } from "@/contexts/LanguageContext";
import { OfficialStreamPlayer, detectType, type HealthCallbacks } from "@/components/OfficialStreamPlayer";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { FavoriteButton } from "@/components/tv/FavoriteButton";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { VirtualChannelList } from "@/components/tv/VirtualChannelList";
import { StreamHealthBadge } from "@/components/tv/StreamHealthBadge";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useWatchReporter } from "@/hooks/useWatchReporter";
import { useStreamHealth } from "@/hooks/useStreamHealth";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";
import { AITaskPanel } from "@/components/AITaskPanel";
import { TVPlayerErrorBoundary } from "@/components/tv/TVPlayerErrorBoundary";

export default function LiveTVWatch() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate      = useNavigate();
  const { t, dir }    = useLanguage();
  const isRTL         = dir === "rtl";
  const BackIcon      = isRTL ? ArrowRight : ArrowLeft;

  const { channels, categories, isSubscribed, isLoading } = useTVSubscription();
  const { record }    = useWatchHistory();
  const health        = useStreamHealth(channelId ?? null);

  // Watch time reporter — silently accumulates and flushes to DB every 30s
  useWatchReporter(channelId ?? null);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  const currentChannel = useMemo(
    () => channels.find(c => c.id === channelId) ?? null,
    [channels, channelId]
  );

  // Record in localStorage watch history whenever the channel changes
  useEffect(() => {
    if (currentChannel) record(currentChannel);
  }, [currentChannel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sidebarChannels = useMemo(() => {
    if (activeCategory === "all") return channels;
    return channels.filter(c => c.category?.slug === activeCategory);
  }, [channels, activeCategory]);

  // Pre-parse all health scores once per channel change (one JSON.parse for all channels)
  const healthScores = useMemo(() => health.getAllScores(), [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable health callbacks object passed to the player — avoids re-mounting player on re-render
  const healthCallbacks = useMemo<HealthCallbacks>(() => ({
    onStreamStart: health.onStreamStart,
    onFirstFrame:  health.onFirstFrame,
    onBufferStart: health.onBufferStart,
    onBufferEnd:   health.onBufferEnd,
    onError:       health.onError,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const chName  = (ch: TVChannel) => isRTL ? (ch.name_ar || ch.name) : (ch.name || ch.name_ar);
  const chDesc  = (ch: TVChannel) => isRTL ? ch.description_ar : ch.description;
  const catName = (cat: { name: string; name_ar: string }) => isRTL ? cat.name_ar : cat.name;

  const handleSidebarClick = (c: TVChannel) => {
    const type = detectType(c.official_url ?? "");
    if (type === "external" && c.official_url) {
      window.open(c.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-tv/watch/${c.id}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4" dir={dir}>

        {/* ── Top bar ───────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/services/live-tv" className="text-muted-foreground hover:text-foreground transition-colors">
              <BackIcon className="w-5 h-5" />
            </Link>
            <div>
              {isLoading && !currentChannel ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t("liveTV.loadingChannels")}</span>
                </div>
              ) : (
                <>
                  <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
                    {currentChannel ? chName(currentChannel) : "VisionTV"}
                    {currentChannel && (
                      <FavoriteButton channelId={currentChannel.id} size="sm" />
                    )}
                  </h1>
                  {currentChannel?.category && (
                    <p className="text-xs text-muted-foreground">
                      {catName(currentChannel.category)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TVSectionNav />
            <Button
              variant="ghost" size="icon"
              onClick={() => setSidebarOpen(s => !s)}
              title={t("player.toggleList")}
              className="h-9 w-9 flex-shrink-0"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Main layout ──────────────────────────────────── */}
        <div className="flex gap-4 items-start">

          {/* ── Player area ── */}
          <div className="flex-1 min-w-0 space-y-4">
            <TVPlayerErrorBoundary resetKey={channelId}>
              <OfficialStreamPlayer
                url={currentChannel?.official_url ?? ""}
                name={currentChannel ? chName(currentChannel) : ""}
                logo={currentChannel?.logo_url}
                isTV
                health={healthCallbacks}
              />
            </TVPlayerErrorBoundary>

            {/* Channel info card */}
            {currentChannel && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-4">
                  {currentChannel.logo_url && (
                    <img
                      src={currentChannel.logo_url}
                      alt={chName(currentChannel)}
                      className="w-14 h-14 rounded-lg object-contain bg-muted p-1 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg">{chName(currentChannel)}</h2>
                      <FavoriteButton channelId={currentChannel.id} size="md" />
                    </div>
                    {chDesc(currentChannel) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {chDesc(currentChannel)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentChannel.category && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {catName(currentChannel.category)}
                        </span>
                      )}
                      <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                        {currentChannel.quality}
                      </span>
                      {currentChannel.country && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {currentChannel.country}
                        </span>
                      )}
                      <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <StreamHealthBadge score={health.getScore()} showLabel />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Companion */}
            {currentChannel && (
              <AITaskPanel
                assistantId="media-companion"
                title={isRTL ? "مرافق التلفزيون الذكي" : "AI TV Companion"}
                description={isRTL
                  ? "اشرح معلومات القناة أو الصق نص الترجمة لتلخيصه وترجمته."
                  : "Explore channel information, or paste captions to summarize and translate."}
                actions={[
                  {
                    label: isRTL ? "اشرح القناة" : "Explain channel",
                    prompt: isRTL
                      ? "اشرح معلومات هذه القناة وما المتوقع من محتواها."
                      : "Explain this channel and its likely content using only the supplied metadata.",
                  },
                  {
                    label: isRTL ? "تبسيط الوصف" : "Simplify description",
                    prompt: isRTL
                      ? "أعد كتابة وصف القناة بلغة بسيطة."
                      : "Rewrite the channel description in plain, accessible language.",
                  },
                ]}
                context={{
                  name:        chName(currentChannel),
                  description: chDesc(currentChannel),
                  category:    currentChannel.category,
                  country:     currentChannel.country,
                  quality:     currentChannel.quality,
                }}
                placeholder={isRTL
                  ? "الصق الترجمة أو ملاحظات البرنامج للتلخيص…"
                  : "Paste captions or program notes to summarize…"}
                compact
              />
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          {sidebarOpen && (
            <div className="w-64 flex-shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] sticky top-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("liveTV.channelList")}
              </p>

              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    activeCategory === "all"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-border text-muted-foreground hover:border-blue-400/40"
                  )}
                >
                  {t("liveTV.all")} ({channels.length})
                </button>
                {categories.map(cat => {
                  const count = channels.filter(c => c.category?.slug === cat.slug).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.slug)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        activeCategory === cat.slug
                          ? "bg-blue-500 text-white border-blue-500"
                          : "border-border text-muted-foreground hover:border-blue-400/40"
                      )}
                    >
                      {catName(cat)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Virtualized channel list */}
              {isLoading && channels.length === 0 ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">{t("liveTV.loading")}</span>
                </div>
              ) : (
                <VirtualChannelList
                  items={sidebarChannels}
                  className="flex-1 overflow-y-auto"
                  getItemKey={(ch) => (ch as TVChannel).id}
                  emptyNode={
                    <p className="text-center text-xs text-muted-foreground py-8">
                      {t("liveTV.noChannels")}
                    </p>
                  }
                  renderItem={(ch) => (
                    <div className="relative">
                      <ChannelCard
                        channel={ch as TVChannel}
                        isSubscribed={isSubscribed}
                        isSelected={(ch as TVChannel).id === channelId}
                        onClick={handleSidebarClick}
                      />
                      {/* Stream health — pre-computed scores, no per-item JSON.parse */}
                      <div className="absolute top-2 end-9 pointer-events-none">
                        <StreamHealthBadge
                          score={healthScores[(ch as TVChannel).id] ?? 100}
                          className="opacity-60"
                        />
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
