import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { OfficialStreamPlayer } from "@/components/OfficialStreamPlayer";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

export default function LiveTVWatch() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const { channels, categories } = useTVSubscription();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentChannel = useMemo(
    () => channels.find(c => c.id === channelId) ?? null,
    [channels, channelId]
  );

  const sidebarChannels = useMemo(() => {
    if (activeCategory === "all") return channels;
    return channels.filter(c => c.category?.slug === activeCategory);
  }, [channels, activeCategory]);

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4" dir="rtl">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/services/live-tv"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg text-foreground">
                {currentChannel?.name_ar ?? "VisionTV"}
              </h1>
              {currentChannel?.category && (
                <p className="text-xs text-muted-foreground">
                  {currentChannel.category.name_ar}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon"
            onClick={() => setSidebarOpen(s => !s)}
            title="قائمة القنوات" className="h-9 w-9">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex gap-4 items-start">

          {/* Player */}
          <div className="flex-1 min-w-0 space-y-4">
            <OfficialStreamPlayer
              url={currentChannel?.official_url ?? ""}
              name={currentChannel?.name_ar ?? ""}
              logo={currentChannel?.logo_url}
              isTV
            />

            {/* Channel info */}
            {currentChannel && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-4">
                  {currentChannel.logo_url && (
                    <img src={currentChannel.logo_url} alt={currentChannel.name_ar}
                      className="w-14 h-14 rounded-lg object-contain bg-muted p-1 flex-shrink-0" />
                  )}
                  <div>
                    <h2 className="font-bold text-lg">{currentChannel.name_ar}</h2>
                    {currentChannel.description_ar && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentChannel.description_ar}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentChannel.category && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {currentChannel.category.name_ar}
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
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="w-64 flex-shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] sticky top-4">
              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setActiveCategory("all")}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    activeCategory === "all"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-border text-muted-foreground hover:border-blue-400/40")}>
                  الكل
                </button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.slug)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      activeCategory === cat.slug
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-border text-muted-foreground hover:border-blue-400/40")}>
                    {cat.name_ar}
                  </button>
                ))}
              </div>

              {/* Channel list */}
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1" style={{ scrollbarWidth: "thin" }}>
                {sidebarChannels.map(ch => (
                  <ChannelCard
                    key={ch.id}
                    channel={ch}
                    isSubscribed
                    isSelected={ch.id === channelId}
                    onClick={(c: TVChannel) => navigate(`/services/live-tv/watch/${c.id}`)}
                  />
                ))}
                {sidebarChannels.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">لا توجد قنوات</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
