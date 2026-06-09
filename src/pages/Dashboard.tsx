import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { RewardedAdModal } from "@/components/RewardedAdModal";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Layout } from "@/components/Layout";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useEarnPoints, DAILY_AD_LIMIT } from "@/hooks/useEarnPoints";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate, Link } from "react-router-dom";
import {
  Star,
  TrendingUp,
  Gift,
  Play,
  BookOpen,
  Briefcase,
  Crown,
  ShoppingCart,
  Sparkles,
  Trophy,
  Gamepad2,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import dashboardImg from "@/assets/dashboard-illustration.jpg";

const VIP_TIERS = [
  { name: "rankBronze",   min: 0,      next: 10000,  color: "text-amber-700 dark:text-amber-500" },
  { name: "rankSilver",   min: 10000,  next: 50000,  color: "text-slate-600 dark:text-slate-300" },
  { name: "rankGold",     min: 50000,  next: 100000, color: "text-yellow-700 dark:text-yellow-400" },
  { name: "rankPlatinum", min: 100000, next: 200000, color: "text-cyan-700 dark:text-cyan-400" },
  { name: "rankDiamond",  min: 200000, next: null,   color: "text-blue-500 dark:text-blue-300" },
];

function getTier(points: number) {
  for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
    if (points >= VIP_TIERS[i].min) return { ...VIP_TIERS[i], index: i };
  }
  return { ...VIP_TIERS[0], index: 0 };
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { totalPoints, history, loadingTotal } = usePoints();
  const { earnPoints, checkDailyLogin, getTodayAdCount } = useEarnPoints();
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [showAd, setShowAd] = useState(false);
  const [todayAdCount, setTodayAdCount] = useState<number>(0);
  const dailyClaimedRef = useRef(false);

  // Auto daily-login bonus — fires once when a user session is confirmed
  useEffect(() => {
    if (!user || dailyClaimedRef.current) return;
    dailyClaimedRef.current = true;
    checkDailyLogin().then((alreadyClaimed) => {
      if (alreadyClaimed) return;
      earnPoints(10, "Daily login bonus").then((ok) => {
        if (ok) {
          playSound("points");
          toast({ title: t("dash.dailyClaimed").replace("{pts}", "10") });
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load today's ad watch count
  useEffect(() => {
    if (!user) return;
    getTodayAdCount().then(setTodayAdCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const handleAdRewarded = useCallback(async () => {
    // Re-check count server-side before awarding (prevents race conditions)
    const count = await getTodayAdCount();
    if (count >= DAILY_AD_LIMIT) {
      toast({ title: t("dash.adLimitReached"), variant: "destructive" });
      setTodayAdCount(DAILY_AD_LIMIT);
      return;
    }
    const pts = 5;
    const ok = await earnPoints(pts, "Watched an ad");
    if (ok) {
      playSound("points");
      setTodayAdCount((c) => c + 1);
      toast({ title: t("dash.adWatched").replace("{pts}", String(pts)) });
    } else {
      toast({ title: t("dash.adError"), variant: "destructive" });
    }
  }, [earnPoints, getTodayAdCount, playSound, t]);

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

        {/* Quick Access */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
              {t("dash.quickLinks")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Gamepad2,     to: "/games",       label: t("dash.playGamesLink"),        desc: t("dash.playGamesLinkDesc"),       color: "text-green-500"   },
                { icon: Users,        to: "/community",   label: t("footer.link.community"),     desc: t("home.feature.servicesDesc"),    color: "text-violet-500"  },
                { icon: ShoppingCart, to: "/bazaar",      label: "VXBazaar",                      desc: t("home.feature.marketplaceDesc"), color: "text-primary"     },
                { icon: BookOpen,     to: "/academy",     label: t("footer.link.academy"),        desc: t("services.catLearn"),            color: "text-blue-500"    },
              ].map((item) => (
                <Link key={item.to} to={item.to} onClick={() => playSound("navigate")} className="group block">
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity History shortcut */}
        <Link to="/profile" className="mb-8 block" onClick={() => playSound("navigate")}>
          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Clock className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold">{t("dash.history")}</p>
                <p className="text-sm text-muted-foreground">{t("dash.historyLinkDesc")}</p>
              </div>
              <Badge variant="secondary" className="text-base">{history.length}</Badge>
            </CardContent>
          </Card>
        </Link>

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
            {!nextTier && tier.name === "rankDiamond" && (
              <p className="mt-2 text-sm font-semibold text-blue-500">🏆 {t("dash.vipMax")}</p>
            )}
            {!nextTier && tier.name !== "rankDiamond" && (
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
                  <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                    {todayAdCount >= DAILY_AD_LIMIT
                      ? t("dash.adLimitReached")
                      : `${todayAdCount} / ${DAILY_AD_LIMIT} ${t("dash.adsToday")}`}
                  </p>
                </div>
                <Badge className="text-sm">+5 VX</Badge>
                <Button
                  onClick={() => setShowAd(true)}
                  disabled={todayAdCount >= DAILY_AD_LIMIT}
                  size="sm"
                  aria-label={`${t("dash.watchAd")} — ${todayAdCount}/${DAILY_AD_LIMIT}`}
                >
                  {t("dash.watchAd")}
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

      </div>

      {showAd && (
        <RewardedAdModal
          onRewarded={handleAdRewarded}
          onClose={() => setShowAd(false)}
        />
      )}
    </Layout>
  );
}
