import { useEffect, useState } from "react";
import { ArrowUp, Search, SlidersHorizontal, History, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { FilterChip } from "./FilterChip";
import type { JobFilters } from "./types";

interface FloatingWidgetsProps {
  onQuickFilter: (patch: Partial<JobFilters>) => void;
  activeFilters: JobFilters;
  recentSearches: string[];
}

export function FloatingWidgets({ onQuickFilter, activeFilters, recentSearches }: FloatingWidgetsProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    playSound("click");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpToSearch = () => {
    playSound("click");
    document.getElementById("careers-search-heading")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="fixed bottom-6 end-6 z-40 flex flex-col items-end gap-3">
      {panelOpen && (
        <div className="w-72 rounded-2xl border border-border bg-card p-4 shadow-xl" role="dialog" aria-label={t("careersPage.floating.quickFilters")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">{t("careersPage.floating.quickFilters")}</p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label={t("careersPage.floating.close")}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip id="qf-remote" label={t("careersPage.filter.workMode.remote")} checked={activeFilters.workModes.includes("remote")} onChange={(c) => onQuickFilter({ workModes: c ? [...activeFilters.workModes, "remote"] : activeFilters.workModes.filter((m) => m !== "remote") })} />
            <FilterChip id="qf-accessible" label={t("careersPage.filter.accessibleJobs")} checked={activeFilters.accessibleJobs} onChange={(c) => onQuickFilter({ accessibleJobs: c })} />
            <FilterChip id="qf-urgent" label={t("careersPage.filter.urgentHiring")} checked={activeFilters.urgentHiring} onChange={(c) => onQuickFilter({ urgentHiring: c })} />
            <FilterChip id="qf-ai" label={t("careersPage.filter.aiJobs")} checked={activeFilters.aiJobs} onChange={(c) => onQuickFilter({ aiJobs: c })} />
          </div>

          {recentSearches.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                {t("careersPage.floating.recentSearches")}
              </div>
              <ul className="flex flex-col gap-1">
                {recentSearches.slice(0, 4).map((query, i) => (
                  <li key={i} className="truncate rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                    {query}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label={t("careersPage.floating.scrollTop")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-label={t("careersPage.floating.quickFilters")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={jumpToSearch}
          aria-label={t("careersPage.floating.jumpToSearch")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
