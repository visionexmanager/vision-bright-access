import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExplorerWorlds } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useMyPassportStamps } from "@/features/visionkids/hooks/explorer/useExplorerPassport";
import { WORLD_COLOR_CLASSES } from "@/features/visionkids/data/explorerWorlds";

/** An interactive "level map" hub — every non-hub world plotted along a
 *  winding path, connected by a line, each stop unlocked/stamped or not.
 *  Node positions are computed from the world count so adding an N+1th
 *  world just extends the path, no hardcoded coordinates. */
export default function VirtualWorld() {
  const { t } = useLanguage();
  const { data: allWorlds = [], isLoading } = useExplorerWorlds();
  const { data: stamps = [] } = useMyPassportStamps();
  const stampedSlugs = new Set(stamps.map((s) => s.world_slug));

  const worlds = allWorlds.filter((w) => w.kind !== "hub");
  const n = worlds.length;

  useDocumentHead({ title: `${t("kids.explorer.virtualWorldTitle")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/virtual-world" });

  const points = worlds.map((_, i) => ({
    x: i % 2 === 0 ? 22 : 78,
    y: n > 1 ? ((i + 0.5) / n) * 100 : 50,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <h1 className="font-heading text-3xl font-extrabold">🗺️ {t("kids.explorer.virtualWorldTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.virtualWorldSubtitle")}</p>

      {isLoading ? (
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      ) : (
        <div className="relative mt-8" style={{ height: `${Math.max(n, 1) * 130}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <path d={pathD} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3" className="text-border" />
          </svg>

          <ol className="contents">
            {worlds.map((world, i) => {
              const stamped = stampedSlugs.has(world.slug);
              const href = world.kind === "simulator" ? `/kids/explorer/${world.slug}` : `/kids/explorer/world/${world.slug}`;
              return (
                <li
                  key={world.slug}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}
                >
                  <Link
                    to={href}
                    className={`flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-center shadow-sm transition-transform hover:scale-105 ${WORLD_COLOR_CLASSES[world.color]}`}
                  >
                    <span className="text-2xl" aria-hidden="true">{world.emoji}</span>
                    {stamped && <span aria-hidden="true">✅</span>}
                  </Link>
                  <p className="mt-1 text-center text-xs font-semibold">{world.title}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
