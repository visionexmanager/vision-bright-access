import { useLanguage } from "@/contexts/LanguageContext";
import type { Npc } from "@/features/visionkids/types/world.types";

/** A friendly NPC greeting card — the quest-giver's face and a hello line. */
export function NpcCard({ npc }: { npc: Npc }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <span className="text-4xl" aria-hidden="true">{npc.emoji}</span>
      <div className="min-w-0">
        <p className="font-heading text-base font-bold leading-tight">{npc.name}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`kids.world.role.${npc.role}`)}</p>
        {npc.greeting && <p className="mt-1 text-sm text-foreground/70">“{npc.greeting}”</p>}
      </div>
    </div>
  );
}
