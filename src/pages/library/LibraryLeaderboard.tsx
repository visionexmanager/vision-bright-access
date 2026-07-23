import { useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Medal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useLeaderboard } from "@/hooks/library/useLeaderboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";
import type { LibraryLeaderboardMetric, LibraryLeaderboardPeriod } from "@/services/library/leaderboard";

const METRICS: LibraryLeaderboardMetric[] = ["readers", "reviewers", "helpful", "clubs", "authors"];
const PERIODS: LibraryLeaderboardPeriod[] = ["week", "month", "year", "all"];

const LINK_PREFIX: Record<LibraryLeaderboardMetric, string | null> = {
  readers: "/library/profile/", reviewers: "/library/profile/", helpful: "/library/profile/",
  clubs: "/library/clubs/", authors: "/library/authors/",
};

const MEDAL_COLOR = ["text-amber-500", "text-slate-400", "text-amber-700"];

export default function LibraryLeaderboard() {
  const { t } = useLanguage();
  const [metric, setMetric] = useState<LibraryLeaderboardMetric>("readers");
  const [period, setPeriod] = useState<LibraryLeaderboardPeriod>("month");
  const { entries, isLoading } = useLeaderboard(metric, period);

  useDocumentHead({ title: t("library.leaderboard.title") });

  const linkPrefix = LINK_PREFIX[metric];

  return (
    <Layout>
      <LibraryLayout title={t("library.leaderboard.title")} breadcrumb={[{ label: t("library.leaderboard.title") }]}>
        <div className="space-y-4">
          <Tabs value={metric} onValueChange={(v) => setMetric(v as LibraryLeaderboardMetric)}>
            <TabsList>
              {METRICS.map((m) => <TabsTrigger key={m} value={m}>{t(`library.leaderboard.metric.${m}`)}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as LibraryLeaderboardPeriod)}>
            <TabsList>
              {PERIODS.map((p) => <TabsTrigger key={p} value={p}>{t(`library.leaderboard.period.${p}`)}</TabsTrigger>)}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <SkeletonLoader variant="list" count={6} />
          ) : entries.length === 0 ? (
            <EmptyState icon={<Trophy className="h-10 w-10" />} title={t("library.leaderboard.empty")} />
          ) : (
            <Card className="divide-y">
              {entries.map((entry, i) => {
                const row = (
                  <div className="flex items-center gap-3 p-3">
                    <span className={cn("w-6 shrink-0 text-center font-bold", i < 3 ? MEDAL_COLOR[i] : "text-muted-foreground")}>
                      {i < 3 ? <Medal className="mx-auto h-5 w-5" aria-hidden="true" /> : i + 1}
                    </span>
                    <Avatar className="h-8 w-8"><AvatarImage src={entry.imageUrl ?? undefined} alt="" /><AvatarFallback>{entry.name.slice(0, 1)}</AvatarFallback></Avatar>
                    <span className="flex-1 truncate font-medium">{entry.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{entry.score}</span>
                  </div>
                );
                return linkPrefix ? <Link key={entry.entityId} to={`${linkPrefix}${entry.entityId}`}>{row}</Link> : <div key={entry.entityId}>{row}</div>;
              })}
            </Card>
          )}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
