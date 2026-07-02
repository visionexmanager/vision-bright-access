import { Link } from "react-router-dom";
import { Globe2, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const SECTION_IDS = [
  "overview", "map", "trends", "salary", "fakejobs", "skills",
  "remote", "visa", "companies", "forecast", "regional",
];

export function IntelligenceHeader() {
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    document.getElementById(`intel-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="border-b intel-border px-4 py-6 sm:px-6">
      <a
        href="#intel-overview"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("intel.skipToContent")}
      </a>
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/careers"
              aria-label={t("intel.backToCareers")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border intel-border intel-muted transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary intel-neon-ring">
              <Globe2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-black">
                <span className="intel-neon-text">{t("intel.title")}</span>
              </h1>
              <p className="intel-muted text-xs">{t("intel.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border intel-border px-3 py-1.5 text-xs font-medium">
            <span className="intel-live-dot h-2 w-2 rounded-full bg-[hsl(var(--intel-positive))]" aria-hidden="true" />
            <span>{t("intel.liveIndicator")}</span>
          </div>
        </div>

        <nav aria-label={t("intel.jumpNav")} className="flex flex-wrap gap-1.5">
          {SECTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className="rounded-full border intel-border px-3 py-1.5 text-xs font-medium intel-muted transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(`intel.nav.${id}`)}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
