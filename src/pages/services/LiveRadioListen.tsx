import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LayoutGrid, Loader2 } from "lucide-react";
import { useRadioSubscription } from "@/hooks/useRadioSubscription";
import { useLanguage } from "@/contexts/LanguageContext";
import { OfficialStreamPlayer, detectType } from "@/components/OfficialStreamPlayer";
import { StationCard } from "@/components/radio/StationCard";
import { cn } from "@/lib/utils";
import type { RadioStation } from "@/hooks/useRadioSubscription";
import { AITaskPanel } from "@/components/AITaskPanel";

export default function LiveRadioListen() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate      = useNavigate();
  const { t, dir }    = useLanguage();
  const isRTL         = dir === "rtl";
  const BackIcon      = isRTL ? ArrowRight : ArrowLeft;

  const { stations, genres, isLoading } = useRadioSubscription();

  const [activeGenre, setActiveGenre] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentStation = useMemo(
    () => stations.find(s => s.id === stationId) ?? null,
    [stations, stationId]
  );

  const sidebarStations = useMemo(() => {
    if (activeGenre === "all") return stations;
    return stations.filter(s => s.genre?.slug === activeGenre);
  }, [stations, activeGenre]);

  const stName  = (st: RadioStation) => isRTL ? (st.name_ar || st.name) : (st.name || st.name_ar);
  const stDesc  = (st: RadioStation) => isRTL ? st.description_ar : st.description;
  const genName = (g: { name: string; name_ar: string }) => isRTL ? g.name_ar : g.name;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4" dir={dir}>

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/services/live-radio"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <BackIcon className="w-5 h-5" />
            </Link>
            <div>
              {isLoading && !currentStation ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t("liveRadio.loadingStation")}</span>
                </div>
              ) : (
                <>
                  <h1 className="font-bold text-lg text-foreground">
                    {currentStation ? stName(currentStation) : "VisionRadio"}
                  </h1>
                  {currentStation?.genre && (
                    <p className="text-xs text-muted-foreground">
                      {genName(currentStation.genre)}
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
              url={currentStation?.official_url ?? ""}
              name={currentStation ? stName(currentStation) : ""}
              logo={currentStation?.logo_url}
              isTV={false}
            />

            {/* Station info */}
            {currentStation && (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-4">
                  {currentStation.logo_url && (
                    <img
                      src={currentStation.logo_url}
                      alt={stName(currentStation)}
                      className="w-16 h-16 rounded-xl object-contain bg-muted p-1 flex-shrink-0 shadow"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg">{stName(currentStation)}</h2>
                    {stDesc(currentStation) && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {stDesc(currentStation)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentStation.genre && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {genName(currentStation.genre)}
                        </span>
                      )}
                      <span className="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full">
                        {currentStation.bitrate === "HI" ? "HI-FI" : `${currentStation.bitrate} kbps`}
                      </span>
                      {currentStation.country && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {currentStation.country}
                        </span>
                      )}
                    </div>
                    {currentStation.website_url && (
                      <a
                        href={currentStation.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs text-orange-500 hover:underline underline-offset-2">
                        {t("liveRadio.officialWebsite")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {currentStation && (
              <AITaskPanel
                assistantId="media-companion"
                title={isRTL ? "مرافق الراديو الذكي" : "AI radio companion"}
                description={isRTL ? "اشرح المحطة أو الصق نص البرنامج لتلخيصه وترجمته." : "Explore the station, or paste program text to summarize and translate it."}
                actions={[
                  { label: isRTL ? "اشرح المحطة" : "Explain station", prompt: isRTL ? "اشرح نوع هذه المحطة ومحتواها المتوقع من البيانات المتوفرة فقط." : "Explain this station and its likely programming using only the supplied metadata." },
                  { label: isRTL ? "ملخص قابل للوصول" : "Accessible summary", prompt: isRTL ? "أعد كتابة وصف المحطة بوضوح وباختصار لمستخدم قارئ الشاشة." : "Rewrite the station description clearly and concisely for a screen-reader user." },
                ]}
                context={{ name: stName(currentStation), description: stDesc(currentStation), genre: currentStation.genre, country: currentStation.country, bitrate: currentStation.bitrate }}
                placeholder={isRTL ? "الصق نص البرنامج أو ملاحظاتك..." : "Paste program text or your notes..."}
                compact
              />
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="w-64 flex-shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] sticky top-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("liveRadio.stationList")}
              </p>

              {/* Genre filter */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveGenre("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    activeGenre === "all"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "border-border text-muted-foreground hover:border-orange-400/40"
                  )}>
                  {t("liveRadio.all")} ({stations.length})
                </button>
                {genres.map(genre => {
                  const count = stations.filter(s => s.genre?.slug === genre.slug).length;
                  return (
                    <button
                      key={genre.id}
                      onClick={() => setActiveGenre(genre.slug)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        activeGenre === genre.slug
                          ? "bg-orange-500 text-white border-orange-500"
                          : "border-border text-muted-foreground hover:border-orange-400/40"
                      )}>
                      {genName(genre)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Station list */}
              <div className="overflow-y-auto space-y-1.5 flex-1" style={{ scrollbarWidth: "thin" }}>
                {isLoading && stations.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">{t("liveRadio.loading")}</span>
                  </div>
                ) : sidebarStations.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">
                    {t("liveRadio.noStations")}
                  </p>
                ) : (
                  sidebarStations.map(st => (
                    <StationCard
                      key={st.id}
                      station={st}
                      isSubscribed
                      isSelected={st.id === stationId}
                      onClick={(s: RadioStation) => {
                        const urlType = detectType(s.official_url ?? "");
                        if (urlType === "external" && s.official_url) {
                          window.open(s.official_url, "_blank", "noopener,noreferrer");
                        } else {
                          navigate(`/services/live-radio/listen/${s.id}`);
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
