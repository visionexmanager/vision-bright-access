import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { useRadioSubscription } from "@/hooks/useRadioSubscription";
import { OfficialStreamPlayer } from "@/components/OfficialStreamPlayer";
import { StationCard } from "@/components/radio/StationCard";
import { cn } from "@/lib/utils";
import type { RadioStation } from "@/hooks/useRadioSubscription";

export default function LiveRadioListen() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { stations, genres } = useRadioSubscription();

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

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4" dir="rtl">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/services/live-radio"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg text-foreground">
                {currentStation?.name_ar ?? "VisionRadio"}
              </h1>
              {currentStation?.genre && (
                <p className="text-xs text-muted-foreground">
                  {currentStation.genre.name_ar}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon"
            onClick={() => setSidebarOpen(s => !s)}
            title="قائمة المحطات" className="h-9 w-9">
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex gap-4 items-start">

          {/* Player area */}
          <div className="flex-1 min-w-0 space-y-4">
            <OfficialStreamPlayer
              url={currentStation?.official_url ?? ""}
              name={currentStation?.name_ar ?? ""}
              logo={currentStation?.logo_url}
              isTV={false}
            />

            {/* Station info */}
            {currentStation && (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-4">
                  {currentStation.logo_url && (
                    <img src={currentStation.logo_url} alt={currentStation.name_ar}
                      className="w-16 h-16 rounded-xl object-contain bg-muted p-1 flex-shrink-0 shadow" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg">{currentStation.name_ar}</h2>
                    {currentStation.description_ar && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {currentStation.description_ar}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentStation.genre && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {currentStation.genre.name_ar}
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
                      <a href={currentStation.website_url} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs text-orange-500 hover:underline underline-offset-2">
                        الموقع الرسمي ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="w-64 flex-shrink-0 flex flex-col gap-3 max-h-[calc(100vh-160px)] sticky top-4">
              {/* Genre filter */}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setActiveGenre("all")}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    activeGenre === "all"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "border-border text-muted-foreground hover:border-orange-400/40")}>
                  الكل
                </button>
                {genres.map(genre => (
                  <button key={genre.id} onClick={() => setActiveGenre(genre.slug)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      activeGenre === genre.slug
                        ? "bg-orange-500 text-white border-orange-500"
                        : "border-border text-muted-foreground hover:border-orange-400/40")}>
                    {genre.name_ar}
                  </button>
                ))}
              </div>

              {/* Station list */}
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1" style={{ scrollbarWidth: "thin" }}>
                {sidebarStations.map(st => (
                  <StationCard
                    key={st.id}
                    station={st}
                    isSubscribed
                    isSelected={st.id === stationId}
                    onClick={(s: RadioStation) => navigate(`/services/live-radio/listen/${s.id}`)}
                  />
                ))}
                {sidebarStations.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">لا توجد محطات</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
