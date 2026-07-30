import { useLanguage } from "@/contexts/LanguageContext";
import { TALENT_RANK_EMOJI } from "@/features/visionkids/data/talentConfig";

/** Shows a Talent Rank or Innovation Rank as an emoji + localized label.
 *  `kind` picks which i18n namespace the slug is looked up in. */
export function RankBadge({
  rank,
  kind,
  label,
}: {
  rank: string;
  kind: "talent" | "innovation";
  label: string;
}) {
  const { t } = useLanguage();
  const rankKey = kind === "talent" ? `kids.talent.rank.${rank}` : `kids.talent.innovationRank.${rank}`;
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <span className="text-3xl" aria-hidden="true">{TALENT_RANK_EMOJI[rank] ?? "⭐"}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-heading text-lg font-bold">{t(rankKey)}</p>
      </div>
    </div>
  );
}
