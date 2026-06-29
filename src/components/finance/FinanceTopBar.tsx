import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, Search, Settings, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FinanceTopBar() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 gap-4"
      role="banner"
    >
      {/* Brand */}
      <Link
        to="/finance"
        className="flex items-center gap-2 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        aria-label="Visionex Finance home"
      >
        <TrendingUp className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">
          {t("finance.title") || "VX Finance"}
        </span>
      </Link>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={t("finance.searchPlaceholder") || "Search symbols, markets…"}
          className="pl-9 h-8 text-sm"
          aria-label={t("finance.searchLabel") || "Search financial instruments"}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" role="group" aria-label="Finance toolbar">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("finance.alerts") || "Market alerts"}
          className="h-8 w-8"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("finance.settings") || "Finance settings"}
          className="h-8 w-8"
          asChild
        >
          <Link to="/finance/settings">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
