import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PROFESSIONAL_TOOLS, TOOL_PRICE } from "@/data/professionalTools";
import { formatVX } from "@/systems/pricingSystem";
import {
  ArrowLeft, Download, Coins, CheckCircle2, ShieldCheck,
  Lock, ChevronRight, Terminal,
} from "lucide-react";
import { useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  performance: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  network:     "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  security:    "bg-red-500/10 text-red-700 dark:text-red-400",
  maintenance: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const ICON_BG: Record<string, string> = {
  performance: "bg-amber-500/10",
  network:     "bg-sky-500/10",
  security:    "bg-red-500/10",
  maintenance: "bg-emerald-500/10",
};

const ICON_COLORS: Record<string, string> = {
  performance: "text-amber-600 dark:text-amber-400",
  network:     "text-sky-600 dark:text-sky-400",
  security:    "text-red-600 dark:text-red-400",
  maintenance: "text-emerald-600 dark:text-emerald-400",
};

export default function ToolDetail() {
  const { toolId } = useParams<{ toolId: string }>();
  const { user } = useAuth();
  const { balance, spendVX } = useVXWallet();
  const { lang } = useLanguage();
  const { playSound } = useSound();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAr = lang === "ar";
  const [buying, setBuying] = useState(false);

  const tool = PROFESSIONAL_TOOLS.find(t => t.id === toolId);

  const { data: purchasedIds = [] } = useQuery({
    queryKey: ["tool-purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("tool_purchases").select("tool_id").eq("user_id", user!.id);
      return (data ?? []).map(r => r.tool_id);
    },
  });

  if (!tool) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">الأداة غير موجودة</p>
          <Button onClick={() => navigate("/professional-tools")}>
            <ArrowLeft className="me-2 h-4 w-4" /> العودة للأدوات
          </Button>
        </div>
      </Layout>
    );
  }

  const Icon = tool.icon;
  const purchased = purchasedIds.includes(tool.id);

  const triggerDownload = () => {
    const a = document.createElement("a");
    a.href = `/tools/${tool.filename}`;
    a.download = tool.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBuy = async () => {
    if (!user) {
      toast({ title: isAr ? "يجب تسجيل الدخول" : "Login required", variant: "destructive" });
      return;
    }
    if (purchased) { triggerDownload(); return; }

    setBuying(true);
    const ok = await spendVX(TOOL_PRICE, "pro_tool", tool.name, tool.id);
    if (!ok) { setBuying(false); return; }

    const { error } = await supabase.from("tool_purchases")
      .insert({ user_id: user.id, tool_id: tool.id, points_spent: TOOL_PRICE });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      setBuying(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tool-purchases", user.id] });
    playSound("success");
    toast({
      title: isAr ? "تم الشراء!" : "Purchased!",
      description: isAr ? `تم خصم ${TOOL_PRICE.toLocaleString()} VX` : `${TOOL_PRICE.toLocaleString()} VX deducted`,
    });
    triggerDownload();
    setBuying(false);
  };

  // Related tools (same category, excluding current)
  const related = PROFESSIONAL_TOOLS.filter(t => t.category === tool.category && t.id !== tool.id).slice(0, 3);

  return (
    <Layout>
      <section className="section-container py-10 max-w-4xl">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/professional-tools" className="hover:text-foreground flex items-center gap-1">
            <Terminal className="h-3.5 w-3.5" />
            {isAr ? "الأدوات الاحترافية" : "Professional Tools"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{isAr ? tool.nameAr : tool.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-4 shrink-0 ${ICON_BG[tool.category]}`}>
                <Icon className={`h-10 w-10 ${ICON_COLORS[tool.category]}`} />
              </div>
              <div>
                <Badge className={`mb-2 border-0 ${CATEGORY_COLORS[tool.category]}`}>
                  {isAr ? tool.categoryAr : tool.category}
                </Badge>
                <h1 className="text-2xl font-bold">{isAr ? tool.nameAr : tool.name}</h1>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  {isAr ? tool.descriptionAr : tool.description}
                </p>
              </div>
            </div>

            {/* Features */}
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">{isAr ? "المميزات" : "Features"}</h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {(isAr ? tool.featuresAr : tool.features).map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* How to use */}
            <Card>
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">{isAr ? "كيفية الاستخدام" : "How to Use"}</h2>
                <ol className="space-y-3">
                  {[
                    isAr ? "اشترِ الأداة بالنقر على زر الشراء" : "Purchase the tool by clicking the buy button",
                    isAr ? "سيتم تحميل ملف .bat تلقائياً" : "A .bat file will be downloaded automatically",
                    isAr ? `${tool.requiresAdmin ? "شغّل الملف كمسؤول (Run as Administrator)" : "شغّل الملف بالضغط عليه مرتين"}` : `${tool.requiresAdmin ? "Run the file as Administrator (right-click → Run as Admin)" : "Double-click the file to run it"}`,
                    isAr ? "انتظر حتى تكتمل العملية" : "Wait for the operation to complete",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {tool.requiresAdmin && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/30 px-4 py-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
                {isAr
                  ? "هذه الأداة تحتاج تشغيلها كمسؤول (Run as Administrator)"
                  : "This tool requires Administrator privileges to run"}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  {purchased ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-5 w-5" />
                      {isAr ? "مشترى بالفعل" : "Already purchased"}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Coins className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">{formatVX(tool.price)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{isAr ? "شراء مرة واحدة" : "One-time purchase"}</p>
                    </>
                  )}
                </div>

                {user && !purchased && (
                  <div className="text-xs text-muted-foreground text-center">
                    {isAr ? "رصيدك:" : "Balance:"}{" "}
                    <span className="font-semibold text-foreground">{balance.toLocaleString()} VX</span>
                  </div>
                )}

                {user ? (
                  <Button
                    className="w-full gap-2 font-semibold"
                    size="lg"
                    onClick={handleBuy}
                    disabled={buying || (!purchased && balance < TOOL_PRICE)}
                    variant={purchased ? "outline" : "default"}
                  >
                    {buying ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{isAr ? "جاري…" : "Processing…"}</>
                    ) : (
                      <><Download className="h-4 w-4" />{purchased ? (isAr ? "تحميل مجاناً" : "Download Free") : (isAr ? "اشترِ وحمّل" : "Buy & Download")}</>
                    )}
                  </Button>
                ) : (
                  <Button asChild className="w-full" size="lg">
                    <Link to="/login">
                      <Lock className="me-2 h-4 w-4" />
                      {isAr ? "سجّل دخولك للشراء" : "Login to Purchase"}
                    </Link>
                  </Button>
                )}

                {!purchased && balance < TOOL_PRICE && user && (
                  <p className="text-xs text-center text-destructive">
                    {isAr ? `تحتاج ${(TOOL_PRICE - balance).toLocaleString()} VX إضافية` : `Need ${(TOOL_PRICE - balance).toLocaleString()} more VX`}
                  </p>
                )}

                <p className="text-xs text-center text-muted-foreground border-t pt-3">
                  {isAr ? "بعد الشراء يمكنك التحميل في أي وقت" : "Re-download anytime after purchase"}
                </p>
              </CardContent>
            </Card>

            {/* Related tools */}
            {related.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">{isAr ? "أدوات مشابهة" : "Related Tools"}</h3>
                <div className="space-y-2">
                  {related.map(t => {
                    const RelIcon = t.icon;
                    return (
                      <Link key={t.id} to={`/professional-tools/${t.id}`}>
                        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted transition-colors">
                          <div className={`rounded-lg p-1.5 ${ICON_BG[t.category]}`}>
                            <RelIcon className={`h-4 w-4 ${ICON_COLORS[t.category]}`} />
                          </div>
                          <span className="text-sm font-medium flex-1">{isAr ? t.nameAr : t.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
