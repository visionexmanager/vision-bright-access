import { Link } from "react-router-dom";
import { Gamepad2, Trophy, Clock, Coins, Star, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useVXWallet } from "@/hooks/useVXWallet";
import { usePlayerGameStats, useMyXpTotal, useLevelForXp } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useMyAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { LevelBadge } from "@/features/visionkids/components/games/LevelBadge";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function GameProfile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = usePlayerGameStats();
  const { data: xp = 0 } = useMyXpTotal();
  const { data: level = 1 } = useLevelForXp(xp);
  const { balance } = useVXWallet();
  const { data: achievements = [] } = useMyAchievements();

  useDocumentHead({ title: t("kids.games.profileTitle"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/profile" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const cards = [
    { icon: Gamepad2, label: t("kids.games.gamesPlayed"), value: stats?.games_played ?? 0, color: "text-kids-primary" },
    { icon: Trophy, label: t("kids.games.wins"), value: stats?.wins ?? 0, color: "text-kids-accent" },
    { icon: Clock, label: t("kids.games.timePlayed"), value: formatDuration(stats?.total_play_seconds ?? 0), color: "text-kids-secondary" },
    { icon: Coins, label: t("kids.games.coins"), value: balance.toLocaleString(), color: "text-kids-green" },
    { icon: Star, label: t("kids.games.level"), value: level, color: "text-kids-purple" },
    { icon: Award, label: t("kids.games.achievementsTitle"), value: achievements.length, color: "text-kids-pink" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-extrabold">{t("kids.games.profileTitle")}</h1>

      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
        <LevelBadge />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <card.icon className={`mx-auto h-6 w-6 ${card.color}`} aria-hidden="true" />
            <p className="mt-2 font-heading text-xl font-extrabold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link to="/kids/games/achievements" className="text-sm font-semibold text-kids-primary hover:underline">{t("kids.games.viewAllAchievements")}</Link>
      </div>
    </div>
  );
}
