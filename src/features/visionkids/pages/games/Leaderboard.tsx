import { useState } from "react";
import { Trophy, Users as UsersIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGameCategories, useFeaturedGames } from "@/features/visionkids/hooks/games/useGameCatalog";
import { useLeaderboard } from "@/features/visionkids/hooks/games/useGameEngagement";
import { LeaderboardTable } from "@/features/visionkids/components/games/LeaderboardTable";
import type { LeaderboardScope } from "@/features/visionkids/services/games/engagement";

export default function Leaderboard() {
  const { t } = useLanguage();
  const { data: games = [] } = useFeaturedGames(50);
  const [gameId, setGameId] = useState<string | null>(null);
  const [scope, setScope] = useState<LeaderboardScope>("global");

  const activeGameId = gameId ?? games[0]?.id ?? null;
  const { data: entries = [], isLoading } = useLeaderboard(activeGameId, scope);

  useDocumentHead({ title: t("kids.games.leaderboardTitle"), description: t("kids.games.meta.description"), canonicalPath: "/kids/games/leaderboard" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Trophy className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.games.leaderboardTitle")}
      </h1>

      <div className="mt-4">
        <Select value={activeGameId ?? undefined} onValueChange={setGameId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t("kids.games.chooseGame")} /></SelectTrigger>
          <SelectContent>
            {games.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as LeaderboardScope)} className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="global">{t("kids.games.scopeGlobal")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("kids.games.scopeWeekly")}</TabsTrigger>
          <TabsTrigger value="monthly">{t("kids.games.scopeMonthly")}</TabsTrigger>
          <TabsTrigger value="friends">{t("kids.games.scopeFriends")}</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4"><LeaderboardTable entries={entries} isLoading={isLoading} /></TabsContent>
        <TabsContent value="weekly" className="mt-4"><LeaderboardTable entries={entries} isLoading={isLoading} /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><LeaderboardTable entries={entries} isLoading={isLoading} /></TabsContent>
        <TabsContent value="friends" className="mt-4">
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <UsersIcon className="h-8 w-8" aria-hidden="true" />
            <p>{t("kids.games.friendsComingSoon")}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
