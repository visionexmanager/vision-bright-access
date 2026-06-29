import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const LABELS: Record<string, string> = {
  finance: "Finance",
  markets: "Markets",
  stocks: "Stocks",
  currencies: "Currencies",
  commodities: "Commodities",
  portfolio: "Portfolio",
  watchlist: "Watchlist",
  "ai-analyst": "AI Analyst",
  calendar: "Economic Calendar",
  news: "Market News",
  affiliate: "Affiliate Center",
  brokers: "Broker Comparison",
  academy: "Finance Academy",
  settings: "Settings",
};

export function FinanceBreadcrumbs() {
  const location = useLocation();
  const { t } = useLanguage();

  const segments = location.pathname.split("/").filter(Boolean);
  // Build up cumulative paths
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg,
    to: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2 border-b"
    >
      <ol className="flex items-center gap-1 flex-wrap" role="list">
        <li>
          <Link
            to="/"
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={t("nav.home") || "Home"}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.to} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {crumb.isLast ? (
              <span aria-current="page" className="text-foreground font-medium">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
