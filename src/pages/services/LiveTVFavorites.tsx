/**
 * LiveTVFavorites
 *
 * Shows the authenticated user's favorited TV channels in a grid.
 * Channels can be played directly or unfavorited from this page.
 */

import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Heart, Tv, ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useFavorites } from "@/hooks/useFavorites";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { FavoriteButton } from "@/components/tv/FavoriteButton";
import { detectType } from "@/components/OfficialStreamPlayer";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

export default function LiveTVFavorites() {
  const navigate = useNavigate();
  const { dir }  = useLanguage();
  const isRTL    = dir === "rtl";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const { user, loading: authLoading } = useAuth();
  const { channels, isSubscribed, isLoading: tvLoading } = useTVSubscription();
  const { favoriteIds, isLoading: favLoading } = useFavorites();

  const favoriteChannels = useMemo(
    () => channels.filter(ch => favoriteIds.includes(ch.id)),
    [channels, favoriteIds]
  );

  const isLoading = authLoading || tvLoading || favLoading;

  const handleClick = (ch: TVChannel) => {
    const type = detectType(ch.official_url ?? "");
    if (type === "external" && ch.official_url) {
      window.open(ch.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-tv/watch/${ch.id}`);
    }
  };

  const chName = (ch: TVChannel) =>
    isRTL ? (ch.name_ar || ch.name) : (ch.name || ch.name_ar);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir={dir}>

        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Link to="/services/live-tv" className="text-muted-foreground hover:text-foreground transition-colors">
            <BackIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-xl text-foreground flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              {isRTL ? "قنواتي المفضلة" : "My Favorites"}
            </h1>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {favoriteChannels.length}{" "}
                {isRTL ? "قناة" : favoriteChannels.length === 1 ? "channel" : "channels"}
              </p>
            )}
          </div>
        </div>

        {/* Section nav */}
        <TVSectionNav />

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>{isRTL ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : !user ? (
          <div className="text-center py-20 space-y-4">
            <Heart className="w-14 h-14 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {isRTL ? "سجل الدخول لحفظ قنواتك المفضلة" : "Log in to save your favorite channels"}
            </p>
          </div>
        ) : favoriteChannels.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Heart className="w-14 h-14 mx-auto text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">
              {isRTL
                ? "لم تضف أي قنوات إلى المفضلة بعد"
                : "You haven't favorited any channels yet"}
            </p>
            <Button variant="outline" asChild size="sm">
              <Link to="/services/live-tv">
                <Tv className="w-4 h-4 me-2" />
                {isRTL ? "تصفح القنوات" : "Browse Channels"}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {favoriteChannels.map(ch => (
              <div key={ch.id} className="relative">
                <ChannelCard
                  channel={ch}
                  isSubscribed={isSubscribed}
                  onClick={handleClick}
                />
                {/* Unfavorite button overlay */}
                <div className="absolute top-1.5 end-1.5">
                  <FavoriteButton channelId={ch.id} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
