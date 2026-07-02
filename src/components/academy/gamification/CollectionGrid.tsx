import { resolveAchievementIcon } from "./achievementIcons";
import { LEARNING_CARD_RARITY_STYLES, TIER_STYLES } from "./tierStyles";
import { Lock } from "lucide-react";

export interface CollectibleItem {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
  /** Achievement/badge tier OR learning-card rarity — same visual language, different vocabulary. */
  rarity: keyof typeof TIER_STYLES | keyof typeof LEARNING_CARD_RARITY_STYLES;
  kind: "tier" | "rarity";
}

interface CollectionSection {
  title: string;
  items: CollectibleItem[];
}

interface CollectionGridProps {
  sections: CollectionSection[];
}

function CollectibleTile({ item }: { item: CollectibleItem }) {
  const style = item.kind === "tier" ? TIER_STYLES[item.rarity as keyof typeof TIER_STYLES] : LEARNING_CARD_RARITY_STYLES[item.rarity];
  const Icon = resolveAchievementIcon(item.icon);

  return (
    <div
      className={`flex flex-col items-center text-center gap-2 p-4 rounded-2xl border ${
        item.unlocked ? `bg-gradient-to-br ${style.gradient} ${style.border}` : "border-dashed border-border bg-muted/30 opacity-70"
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.unlocked ? style.text : "text-muted-foreground"}`} aria-hidden="true">
        {item.unlocked ? <Icon className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
      </div>
      <p className="text-xs font-bold text-foreground line-clamp-2">{item.unlocked ? item.title : "غير مكتشف"}</p>
      <span className={`text-[10px] font-bold ${item.unlocked ? style.text : "text-muted-foreground"}`}>{style.label}</span>
    </div>
  );
}

export function CollectionGrid({ sections }: CollectionGridProps) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h3 className="text-sm font-black text-foreground">{section.title}</h3>
          {section.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا عناصر في هذه المجموعة بعد.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {section.items.map((item) => <CollectibleTile key={item.id} item={item} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
