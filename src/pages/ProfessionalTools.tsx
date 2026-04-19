import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AnimatedSection, StaggerGrid, StaggerItem } from "@/components/AnimatedSection";
import { PROFESSIONAL_TOOLS, TOOL_CATEGORIES, TOOL_PRICE } from "@/data/professionalTools";
import { Link } from "react-router-dom";
import { Coins, Download, ShieldCheck, CheckCircle2, Lock, Terminal } from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";

const CATEGORY_COLORS: Record<string, string> = {
  performance: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  network:     "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  security:    "bg-red-500/10 text-red-700 dark:text-red-400",
  maintenance: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const ICON_COLORS: Record<string, string> = {
  performance: "text-amber-600 dark:text-amber-400",
  network:     "text-sky-600 dark:text-sky-400",
  security:    "text-red-600 dark:text-red-400",
  maintenance: "text-emerald-600 dark:text-emerald-400",
};

const ICON_BG: Record<string, string> = {
  performance: "bg-amber-500/10",
  network:     "bg-sky-500/10",
  security:    "bg-red-500/10",
  maintenance: "bg-emerald-500/10",
};

export default function ProfessionalTools() {
  const { user } = useAuth();
  const { balance, spendVX } = useVXWallet();
  const { language } = useLanguage();
  const { playSound } = useSound();
  const queryClient = useQueryClient();
  const isAr = language === "ar";

  const [activeCategory, setActiveCategory] = useState("all");
  const [buying, setBuying] = useState<string | null>(null);

  // Load user's purchased tools
  const { data: purchasedIds = [] } = useQuery({
    queryKey: ["tool-purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tool_purchases")
        .select("tool_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.tool_id);
    },
  });

  const filtered = activeCategory === "all"
    ? PROFESSIONAL_TOOLS
    : PROFESSIONAL_TOOLS.filter((t) => t.category === activeCategory);

  const handleBuyAndDownload = async (toolId: string, filename: string, name: string) => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to purchase tools.", variant: "destructive" });
      return;
    }

    // Already purchased — just download
    if (purchasedIds.includes(toolId)) {
      triggerDownload(filename);
      return;
    }

    setBuying(toolId);
    const ok = await spendVX(TOOL_PRICE, "pro_tool", name, toolId);
    if (!ok) { setBuying(null); return; }

    // Record purchase
    const { error } = await supabase
      .from("tool_purchases")
      .insert({ user_id: user.id, tool_id: toolId, points_spent: TOOL_PRICE });

    if (error) {
      toast({ title: "Purchase record failed", description: error.message, variant: "destructive" });
      setBuying(null);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tool-purchases", user.id] });
    playSound("success");
    toast({
      title: isAr ? "تم الشراء!" : "Purchase successful!",
      description: isAr
        ? `تم خصم ${TOOL_PRICE.toLocaleString()} VX — جاري التحميل…`
        : `${TOOL_PRICE.toLocaleString()} VX deducted — downloading…`,
    });

    triggerDownload(filename);
    setBuying(null);
  };

  const triggerDownload = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/tools/${filename}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Layout>
      <section className="section-container py-10">

        {/* Header */}
        <AnimatedSection>
          <div className="mb-8 flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-4 shrink-0">
              <Terminal className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {isAr ? "الأدوات الاحترافية" : "Professional Tools"}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {isAr
                  ? "أدوات Windows احترافية مُعدّة خصيصاً من Visionex — كل أداة بـ 1,000 VX"
                  : "Windows tools built exclusively by Visionex — each tool costs 1,000 VX"}
              </p>
            </div>
          </div>

          {/* Balance bar */}
          {user ? (
            <div className="mb-6 flex items-center gap-2 rounded-xl border bg-muted/40 px-5 py-3 w-fit">
              <Coins className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">
                {isAr ? "رصيدك:" : "Your balance:"} {balance.toLocaleString()} VX
              </span>
              <span className="text-xs text-muted-foreground">
                ({isAr ? "يكفي لـ" : "enough for"} {Math.floor(balance / TOOL_PRICE)} {isAr ? "أداة" : "tools"})
              </span>
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-5 py-3 w-fit">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isAr ? "سجّل دخولك للشراء" : "Log in to purchase"}{" "}
                <Link to="/login" className="text-primary font-semibold underline">
                  {isAr ? "تسجيل الدخول" : "Login"}
                </Link>
              </span>
            </div>
          )}
        </AnimatedSection>

        {/* Category filter */}
        <AnimatedSection className="mb-6 flex flex-wrap gap-2">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {isAr ? cat.labelAr : cat.label}
            </button>
          ))}
        </AnimatedSection>

        {/* Tools grid */}
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => {
            const Icon = tool.icon;
            const purchased = purchasedIds.includes(tool.id);
            const isBuying = buying === tool.id;

            return (
              <StaggerItem key={tool.id}>
                <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col gap-4 p-6">

                    {/* Icon + category */}
                    <div className="flex items-start justify-between">
                      <div className={`rounded-xl p-3 ${ICON_BG[tool.category]}`}>
                        <Icon className={`h-7 w-7 ${ICON_COLORS[tool.category]}`} aria-hidden="true" />
                      </div>
                      <Badge className={`text-xs font-medium border-0 ${CATEGORY_COLORS[tool.category]}`}>
                        {isAr ? tool.categoryAr : tool.category}
                      </Badge>
                    </div>

                    {/* Name + description */}
                    <div className="flex-1">
                      <h2 className="text-lg font-bold mb-1.5">
                        {isAr ? tool.nameAr : tool.name}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {isAr ? tool.descriptionAr : tool.description}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="grid grid-cols-2 gap-1">
                      {(isAr ? tool.featuresAr : tool.features).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Admin badge */}
                    {tool.requiresAdmin && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        {isAr ? "يحتاج صلاحيات المسؤول" : "Requires admin privileges"}
                      </div>
                    )}

                    {/* Price + CTA */}
                    <div className="mt-auto pt-2 border-t flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {purchased ? (
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            {isAr ? "مشترى" : "Purchased"}
                          </span>
                        ) : (
                          <>
                            <Coins className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-primary">{formatVX(tool.price)}</span>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={purchased ? "outline" : "default"}
                        className="gap-1.5 font-semibold"
                        disabled={isBuying || (!purchased && !user)}
                        onClick={() => handleBuyAndDownload(tool.id, tool.filename, tool.name)}
                      >
                        {isBuying ? (
                          <span className="flex items-center gap-1.5">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            {isAr ? "جاري…" : "Processing…"}
                          </span>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            {purchased
                              ? (isAr ? "تحميل" : "Download")
                              : (isAr ? "اشترِ وحمّل" : "Buy & Download")}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        {/* Info note */}
        <AnimatedSection className="mt-10">
          <div className="rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">
              {isAr ? "ملاحظة" : "Note"}
            </p>
            <p>
              {isAr
                ? "جميع الأدوات مُصمّمة لـ Windows وتعمل كملفات .bat. بعض الأدوات تحتاج تشغيلها كمسؤول (Run as Administrator). بمجرد الشراء يمكنك تحميل الأداة في أي وقت."
                : "All tools are designed for Windows and run as .bat files. Some tools require running as Administrator. Once purchased, you can re-download the tool anytime."}
            </p>
          </div>
        </AnimatedSection>

      </section>
    </Layout>
  );
}
