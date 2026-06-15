import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LayoutGrid, Loader2 } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useLanguage } from "@/contexts/LanguageContext";
import { OfficialStreamPlayer, detectType } from "@/components/OfficialStreamPlayer";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";
import { AITaskPanel } from "@/components/AITaskPanel";

export default function LiveTVWatch() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate      = useNavigate();
  const { t, dir }    = useLanguage();
  const isRTL         = dir === "rtl";
  const BackIcon      = isRTL ? ArrowRight : ArrowLeft;

  const { channels, categories, isLoading } = useTVSubscription();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  const currentChannel = useMemo(
    () => channels.find(c => c.id === channelId) ?? null,
    [channels, channelId]
  );

  const sidebarChannels = useMemo(() => {
    if (activeCategory === "all") return channels;
    return channels.filter(c => c.category?.slug === activeCategory);
  }, [channels, activeCategory]);

  // Language-aware field helpers
  const chName     = (ch: TVChannel) => isRTL ? (ch.name_ar || ch.name) : (ch.name || ch.name_ar);
  const chDesc     = (ch: TVChannel) => isRTL ? ch.description_ar : ch.description;
  const catName    = (cat: { name: string; name_ar: string }) => isRTL ? cat.name_ar : cat.name;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4" dir={dir}>

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/services/live-tv"
              className="text-muted-foreground hover:text-foreground transition-colors">
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
                  <h1 className="font-bold text-lg text-foreground">
                    {currentChannel ? chName(currentChannel) : "VisionTV"}
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
          <Button
            variant="ghost" size="icon"
            onClick={() => setSidebarOpen(s => !s)}
            title={t("player.toggleList")}
            className="h-9 w-9">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex gap-4 items-start">

          {/* Player */}
          <div className="flex-1 min-w-0 space-y-4">
            <OfficialStreamPlayer
              url={currentChannel?.official_url ?? ""}
              name={currentChannel ? chName(currentChannel) : ""}
              logo={currentChannel?.logo_url}
              isTV
            />

            {/* Channel info */}
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
                  <div>
                    <h2 className="font-bold text-lg">{chName(currentChannel)}</h2>
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
                    </div>
                  </div>
                </div>
              </div>
            )}
            {currentChannel && (
              <AITaskPanel
                assistantId="media-companion"
                title={isRTL ? "مرافق التلفزيون الذكي" : "AI TV companion"}
                description={isRTL ? "اشرح معلومات القناة أو الصق نص الترجمة لتلخيصه وترجمته." : "Explore channel information, or paste captions to summarize and translate them."}
                actions={[
                  { label: isRTL ? "اشرح القناة" : "Explain channel", prompt: isRTL ? "اشرح معلومات هذه القناة وما المتوقع من محتواها اعتمادا على البيانات المتوفرة فقط." : "Explain this channel and its likely content using only the supplied metadata." },
                  { label: isRTL ? "تبسيط الوصف" : "Simplify description", prompt: isRTL ? "أعد كتابة وصف القناة بلغة بسيطة مناسبة لقارئ الشاشة." : "Rewrite the channel description in simple screen-reader-friendly language." },
                ]}
                context={{ name: chName(currentChannel), description: chDesc(currentChannel), category: currentChannel.category, country: currentChannel.country, quality: currentChannel.quality }}
                placeholder={isRTL ? "الصق الترجمة أو ملاحظات البرنامج للتلخيص..." : "Paste captions or program notes to summarize..."}
                compact
              />
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="w-64 flex-shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] sticky top-4">
              {/* Section label */}
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
                  )}>
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
                      )}>
                      {catName(cat)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Channel list */}
              <div className="overflow-y-auto space-y-1.5 flex-1" style={{ scrollbarWidth: "thin" }}>
                {isLoading && channels.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">{t("liveTV.loading")}</span>
                  </div>
                ) : sidebarChannels.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    {t("liveTV.noChannels")}
                  </p>
                ) : (
                  sidebarChannels.map(ch => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      isSubscribed
                      isSelected={ch.id === channelId}
                      onClick={(c: TVChannel) => {
                        const urlType = detectType(c.official_url ?? "");
                        if (urlType === "external" && c.official_url) {
                          window.open(c.official_url, "_blank", "noopener,noreferrer");
                        } else {
                          navigate(`/services/live-tv/watch/${c.id}`);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
