// Still mock — `communities`/`community_members` tables exist and map
// reasonably well, but each community's bundled posts/events/resources have
// no matching columns yet. Future phase.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users2, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { CommunityGrid } from "@/components/career/community/CommunityGrid";
import { CommunityDetail } from "@/components/career/community/CommunityDetail";
import { MOCK_COMMUNITIES } from "@/components/career/community/mock/mockCommunities";
import type { Community } from "@/components/career/community/types";
import "@/components/career/network/NetworkTokens.css";

export default function CareerCommunity() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const [communities, setCommunities] = useState<Community[]>(MOCK_COMMUNITIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleJoin = (id: string) => setCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, isJoined: !c.isJoined } : c)));
  const selected = communities.find((c) => c.id === selectedId) ?? null;

  return (
    <div data-network className="min-h-screen bg-background">
      <a
        href="#community-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("networkUI.skipToContent")}
      </a>
      <header className="flex h-14 items-center justify-between border-b bg-card/70 px-4 backdrop-blur-md sm:px-6" role="banner">
        <Link to="/careers" aria-label={t("communityUI.backToCareers")} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="flex items-center gap-2 font-bold"><Users2 className="h-5 w-5 text-primary" aria-hidden="true" />{t("communityUI.title")}</p>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("networkUI.topbar.toggleTheme")} className="h-8 w-8">
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </header>

      <main id="community-main" tabIndex={-1} role="main" className="section-container py-8 focus:outline-none">
        {!selected && (
          <div className="mb-6">
            <h1 className="type-heading mb-1">{t("communityUI.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("communityUI.subtitle")}</p>
          </div>
        )}
        {selected ? (
          <CommunityDetail community={selected} onBack={() => setSelectedId(null)} onToggleJoin={toggleJoin} />
        ) : (
          <CommunityGrid communities={communities} onOpen={setSelectedId} onToggleJoin={toggleJoin} />
        )}
      </main>
    </div>
  );
}
