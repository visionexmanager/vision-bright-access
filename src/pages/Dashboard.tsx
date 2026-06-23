import { useState, useCallback, useEffect, useRef } from "react";
import { RewardedAdModal } from "@/components/RewardedAdModal";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints, DAILY_AD_LIMIT } from "@/hooks/useEarnPoints";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate, Link } from "react-router-dom";
import {
  Gift,
  Play,
  BookOpen,
  Briefcase,
  ShoppingCart,
  Sparkles,
  Gamepad2,
  Users,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import dashboardImg from "@/assets/dashboard-illustration.jpg";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
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

  const handleAdRewarded = useCallback(async () => {
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

        {/* Quick Access */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
              {t("dash.quickLinks")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: Gamepad2,     to: "/games",     label: t("dash.playGamesLink"),    desc: t("dash.playGamesLinkDesc"),    color: "text-green-500"  },
                { icon: Users,        to: "/community", label: t("footer.link.community"), desc: t("home.feature.servicesDesc"), color: "text-violet-500" },
                { icon: ShoppingCart, to: "/bazaar",    label: "VXBazaar",                  desc: t("dash.vxbazaarDesc"),         color: "text-primary"    },
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

        {/* Earn Points */}
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
