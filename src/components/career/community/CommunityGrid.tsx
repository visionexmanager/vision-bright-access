import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CommunityCard } from "./CommunityCard";
import type { Community, CommunityCategory } from "./types";

const CATEGORIES: CommunityCategory[] = ["technology", "industry", "business", "accessibility", "workStyle"];

interface CommunityGridProps {
  communities: Community[];
  onOpen: (id: string) => void;
  onToggleJoin: (id: string) => void;
}

export function CommunityGrid({ communities, onOpen, onToggleJoin }: CommunityGridProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<CommunityCategory | "all">("all");
  const filtered = filter === "all" ? communities : communities.filter((c) => c.category === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("communityUI.filterLabel")}>
        <button type="button" onClick={() => setFilter("all")} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
          {t("communityUI.allCategories")}
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} type="button" onClick={() => setFilter(cat)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === cat ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {t(`communityUI.category.${cat}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((community) => (
          <CommunityCard key={community.id} community={community} onOpen={onOpen} onToggleJoin={onToggleJoin} />
        ))}
      </div>
    </div>
  );
}
