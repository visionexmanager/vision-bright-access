import { useState } from "react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Layout } from "@/components/Layout";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate, Link } from "react-router-dom";
import {
  Star,
  TrendingUp,
  Gift,
  Play,
  CalendarCheck,
  BookOpen,
  Briefcase,
  Crown,
  ShoppingCart,
  Sparkles,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import dashboardImg from "@/assets/dashboard-illustration.jpg";

const VIP_TIERS = [
  { name: "rankBronze", min: 0, next: 10000, color: "text-amber-700 dark:text-amber-500" },
  { name: "rankSilver", min: 10000, next: 50000, color: "text-slate-600 dark:text-slate-300" },
  { name: "rankGold", min: 50000, next: 100000, color: "text-yellow-700 dark:text-yellow-400" },
  { name: "rankPlatinum", min: 100000, next: 200000, color: "text-cyan-700 dark:text-cyan-400" },
];

function getTier(points: number) {
  for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
    if (points >= VIP_TIERS[i].min) return { ...VIP_TIERS[i], index: i };
  }
  return { ...VIP_TIERS[0], index: 0 };
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { totalPoints, history, loadingTotal, loadingHistory } = usePoints();
  const { earnPoints, checkDailyLogin } = useEarnPoints();
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [adLoading, setAdLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const tier = getTier(totalPoints);
  const nextTier = VIP_TIERS[tier.index + 1];
  const progressPct = nextTier
    ? Math.min(100, ((totalPoints - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100;

  const handleWatchAd = async () => {
    setAdLoading(true);
    // Simulate ad watch delay
    await new Promise((r) => setTimeout(r, 2000));
    const pts = 5;
    const ok = await earnPoints(pts, "Watched an ad");
    setAdLoading(false);
    if (ok) {
      playSound("points");
      toast({ title: t("dash.adWatched").replace("{pts}", String(pts)) });
    }
  };

  const handleDailyLogin = async () => {
    setDailyLoading(true);
    const alreadyClaimed = await checkDailyLogin();
    if (alreadyClaimed) {
      setDailyLoading(false);
      toast({ title: t("dash.alreadyClaimed"), variant: "destructive" });
      return;
    }
    const pts = 10;
    const ok = await earnPoints(pts, "Daily login bonus");
    setDailyLoading(false);
    if (ok) {
      playSound("points");
      toast({ title: t("dash.dailyClaimed").replace("{pts}", String(pts)) });
    }
  };

  return (
    <Layout>
      <div className="section-container py-10">
        {/* Dashboard banner */}
        <AnimatedSection variants={scaleFade}>
        <div className="relative mb-8 overflow-hidden rounded-2xl">
          <img src={dashboardImg} alt="" role="presentation" className="h-36 w-full object-cover sm:h-44" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <h1 className="text-3xl font-bold">{t("dash.title")}</h1>
            <p className="text-lg text-muted-foreground">
              {t("dash.welcome").replace("{name}", user.user_metadata?.display_name || user.email || "")}
            </p>
          </div>
        </div>
        </AnimatedSection>

        {/* Top stats */}
        <StaggerGrid className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Points */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Star className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("dash.totalPoints")}</p>
                {loadingTotal ? (
                  <Skeleton className="mt-1 h-8 w-20" />
                ) : (
                  <p className="text-3xl font-bold text-primary" aria-live="polite">
                    {totalPoints.toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activities */}
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-accent/10 p-3">
                <TrendingUp className="h-8 w-8 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("dash.activities")}</p>
                <p className="text-3xl font-bold">{history.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* VIP Tier */}
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Crown className={`h-8 w-8 ${tier.color}`} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">{t("dash.vipTier")}</p>
                <p className={`text-2xl font-bold ${tier.color}`}>{t(`dash.${tier.name}`)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Spend Points */}
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <ShoppingCart className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("dash.spendPoints")}</p>
                <p className="text-sm text-muted-foreground">{t("dash.spendDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </StaggerGrid>

        {/* VIP Progress */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className={`h-5 w-5 ${tier.color}`} aria-hidden="true" />
                <span className="text-base font-semibold">{t(`dash.${tier.name}`)}</span>
              </div>
              {nextTier && (
                <span className="text-sm text-muted-foreground">
                  {t("dash.vipProgress")
                    .replace("{current}", totalPoints.toLocaleString())
                    .replace("{next}", nextTier.min.toLocaleString())}
                </span>
              )}
            </div>
            <Progress value={progressPct} className="h-3" aria-label={`VIP progress: ${totalPoints} of ${nextTier?.min ?? 'max'} points`} />
            {!nextTier && (
              <p className="mt-2 text-sm text-muted-foreground">{t("dash.vipComingSoon")}</p>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard link */}
        <Link to="/leaderboard" className="mb-8 block">
          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Trophy className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold">{t("leader.title")}</p>
                <p className="text-sm text-muted-foreground">{t("leader.subtitle")}</p>
              </div>
              <Badge variant="secondary" className="text-base">{t(`dash.${tier.name}`)}</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Earn Points section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-6 w-6 text-primary" aria-hidden="true" />
              {t("dash.earnPoints")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Watch Ad */}
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Play className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">{t("dash.watchAd")}</p>
                  <p className="text-sm text-muted-foreground">{t("dash.watchAdDesc")}</p>
                </div>
                <Badge className="text-sm">+5 pts</Badge>
                <Button onClick={handleWatchAd} disabled={adLoading} size="sm">
                  {adLoading ? "..." : t("dash.watchAd")}
                </Button>
              </div>

              {/* Daily Login */}
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="rounded-xl bg-primary/10 p-3">
                  <CalendarCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">{t("dash.dailyLogin")}</p>
                  <p className="text-sm text-muted-foreground">{t("dash.dailyLoginDesc")}</p>
                </div>
                <Badge className="text-sm">+10 pts</Badge>
                <Button onClick={handleDailyLogin} disabled={dailyLoading} size="sm">
                  {dailyLoading ? "..." : t("dash.dailyLogin")}
                </Button>
              </div>

              {/* Engage Content */}
              <Link to="/content" className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="rounded-xl bg-primary/10 p-3">
                  <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">{t("dash.engageContent")}</p>
                  <p className="text-sm text-muted-foreground">{t("dash.engageContentDesc")}</p>
                </div>
                <Badge className="text-sm">+10–50 pts</Badge>
              </Link>

              {/* Use Services */}
              <Link to="/services" className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="rounded-xl bg-primary/10 p-3">
                  <Briefcase className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">{t("dash.useServices")}</p>
                  <p className="text-sm text-muted-foreground">{t("dash.useServicesDesc")}</p>
                </div>
                <Badge className="text-sm">+60–120 pts</Badge>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <div className="mb-8">
          <AchievementsPanel />
        </div>

        {/* Points history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("dash.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {t("dash.noActivity")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">{t("dash.activity")}</TableHead>
                    <TableHead className="text-base">{t("dash.points")}</TableHead>
                    <TableHead className="text-base">{t("dash.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-base font-medium">{entry.reason}</TableCell>
                      <TableCell>
                        <Badge variant={entry.points > 0 ? "default" : "destructive"} className="text-sm">
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
