import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";

type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  rank: number;
};

export default function Leaderboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        result_limit: 20,
      });
      if (error) throw error;
      return (data as LeaderboardEntry[]) ?? [];
    },
  });

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" aria-label="1st place" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-slate-400" aria-label="2nd place" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-700" aria-label="3rd place" />;
    return <span className="text-lg font-bold text-muted-foreground">{rank}</span>;
  };

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="leader-heading">
        <h1 id="leader-heading" className="mb-2 text-3xl font-bold">{t("leader.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("leader.subtitle")}</p>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <p className="py-12 text-center text-lg text-muted-foreground">
                {t("leader.empty")}
              </p>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => {
                  const isCurrentUser = user?.id === entry.user_id;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                        isCurrentUser ? "bg-primary/5" : ""
                      } ${entry.rank <= 3 ? "bg-muted/30" : ""}`}
                    >
                      {/* Rank */}
                      <div className="flex w-10 items-center justify-center">
                        {rankIcon(entry.rank)}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-10 w-10">
                        {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name} />}
                        <AvatarFallback className="text-base font-bold">
                          {entry.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name */}
                      <div className="flex-1">
                        <p className="text-base font-semibold">
                          {entry.display_name}
                          {isCurrentUser && (
                            <span className="ms-2 text-sm font-medium text-primary">
                              {t("leader.you")}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Points */}
                      <Badge
                        className="text-base"
                        variant={entry.rank <= 3 ? "default" : "secondary"}
                      >
                        {entry.total_points.toLocaleString()} pts
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
