import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Radio, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRadioSubscription } from "@/hooks/useRadioSubscription";
import { RadioSubscriptionStatus } from "@/components/radio/RadioSubscriptionStatus";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useCurrency } from "@/contexts/CurrencyContext";

const planIcons: Record<string, React.ReactNode> = {
  Daily:   <Zap className="w-6 h-6" />,
  Weekly:  <Radio className="w-6 h-6" />,
  Monthly: <Crown className="w-6 h-6" />,
  Yearly:  <Crown className="w-6 h-6 text-yellow-400" />,
};

const planColors: Record<string, string> = {
  Daily:   "border-slate-400/40  bg-slate-500/5",
  Weekly:  "border-orange-400/40 bg-orange-500/5",
  Monthly: "border-purple-400/40 bg-purple-500/5",
  Yearly:  "border-yellow-400/40 bg-yellow-500/5 shadow-yellow-500/10",
};

const planBadge: Record<string, string | null> = {
  Daily:   null,
  Weekly:  null,
  Monthly: "الأكثر شيوعاً",
  Yearly:  "أفضل قيمة",
};

export default function LiveRadioSubscribe() {
  const navigate  = useNavigate();
  const { subscription, isSubscribed, daysRemaining, plans, subscribe } = useRadioSubscription();
  const { balance } = useVXWallet();
  const { vxToLocal } = useCurrency();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoadingId(planId);
    const ok = await subscribe(planId);
    setLoadingId(null);
    if (ok) navigate("/services/live-radio");
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10" dir="rtl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to="/services/live-radio" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowRight className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold text-foreground">اشتراك VisionRadio</h1>
            </div>
            <p className="text-muted-foreground">اختر الخطة المناسبة واستمتع بالاستماع إلى مئات المحطات</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RadioSubscriptionStatus
              subscription={subscription}
              isSubscribed={isSubscribed}
              daysRemaining={daysRemaining}
            />
            <p className="text-sm text-muted-foreground">
              رصيدك: <span className="font-bold text-foreground">{balance.toLocaleString()} VX</span>
            </p>
          </div>
        </div>

        {/* Active subscription banner */}
        {isSubscribed && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-orange-600">لديك اشتراك نشط بالفعل</p>
              <p className="text-sm text-muted-foreground mt-1">
                ينتهي الاشتراك خلال <strong>{daysRemaining}</strong> {daysRemaining === 1 ? "يوم" : "أيام"}
              </p>
            </div>
            <Button asChild variant="outline" className="border-orange-500/40 text-orange-600 hover:bg-orange-500/10">
              <Link to="/services/live-radio">العودة للاستماع</Link>
            </Button>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const badge  = planBadge[plan.name];
            const enough = balance >= plan.vx_price;
            const local  = typeof vxToLocal === "function" ? vxToLocal(plan.vx_price) : null;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
                  planColors[plan.name] ?? "border-border bg-card",
                  badge ? "shadow-lg" : ""
                )}
              >
                {badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-orange-600 text-white border-0 px-3 py-1 text-xs font-bold shadow-md">
                      {badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-3 text-center">
                  <div className="flex justify-center mb-2 text-muted-foreground">
                    {planIcons[plan.name] ?? <Radio className="w-6 h-6" />}
                  </div>
                  <CardTitle className="text-lg">{plan.name_ar}</CardTitle>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold text-foreground">
                      {plan.vx_price.toLocaleString()}
                      <span className="text-base font-semibold text-muted-foreground mr-1">VX</span>
                    </p>
                    {local && (
                      <p className="text-xs text-muted-foreground mt-0.5">{local}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.duration_days === 1 ? "ليوم واحد" : `لمدة ${plan.duration_days} يوماً`}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  <ul className="space-y-2">
                    {(plan.features as string[]).map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    disabled={isSubscribed || !enough || loadingId === plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                    variant={badge ? "default" : "outline"}
                  >
                    {loadingId === plan.id
                      ? "جاري الاشتراك…"
                      : isSubscribed
                      ? "مشترك بالفعل"
                      : !enough
                      ? "رصيد غير كافٍ"
                      : "اشترك الآن"}
                  </Button>

                  {!enough && !isSubscribed && (
                    <p className="text-xs text-center text-destructive">
                      تحتاج {(plan.vx_price - balance).toLocaleString()} VX إضافية
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info note */}
        <p className="text-center text-sm text-muted-foreground">
          يتم خصم رصيد VX فوراً عند الاشتراك · 1000 VX = 1 USD · لا استرداد بعد التفعيل
        </p>
      </div>
    </Layout>
  );
}
