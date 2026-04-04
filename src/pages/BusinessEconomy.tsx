import { useState, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, PieChart, LineChart, BadgeDollarSign, Target,
  Lightbulb, TrendingUp, Calculator, DollarSign, Building2,
  Users, Globe, ChevronRight, Sparkles, ArrowUpRight, ArrowDownRight,
  Briefcase, ShieldCheck, Download
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const speak = (text: string, lang: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ar" ? "ar-SA" : lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
};

type TabId = "feasibility" | "management" | "investment" | "innovation";

interface FeasibilityResult {
  roi: number;
  breakEven: number;
  netProfit: number;
  riskLevel: string;
  recommendation: string;
}

export default function BusinessEconomy() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("feasibility");

  // Feasibility state
  const [projectName, setProjectName] = useState("");
  const [budget, setBudget] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [sector, setSector] = useState("");
  const [result, setResult] = useState<FeasibilityResult | null>(null);

  const analyzeFeasibility = () => {
    const b = parseFloat(budget) || 0;
    const cost = parseFloat(monthlyCost) || 0;
    const rev = parseFloat(monthlyRevenue) || 0;

    if (!b || !rev) {
      toast.error(t("econ.fillRequired"));
      return;
    }

    const monthlyProfit = rev - cost;
    const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(b / monthlyProfit) : 999;
    const annualProfit = monthlyProfit * 12;
    const roi = b > 0 ? (annualProfit / b) * 100 : 0;
    const riskLevel = roi > 50 ? t("econ.lowRisk") : roi > 20 ? t("econ.mediumRisk") : t("econ.highRisk");
    const recommendation =
      roi > 50
        ? t("econ.strongProject")
        : roi > 20
        ? t("econ.goodProject")
        : roi > 0
        ? t("econ.cautionProject")
        : t("econ.notRecommended");

    setResult({ roi, breakEven: breakEvenMonths, netProfit: annualProfit, riskLevel, recommendation });
    toast.success(t("econ.analysisComplete"));
    speak(t("econ.analysisComplete"), lang);
  };

  const tabs: { id: TabId; labelKey: string; icon: React.ReactNode }[] = [
    { id: "feasibility", labelKey: "econ.feasibility", icon: <Calculator className="w-5 h-5" /> },
    { id: "management", labelKey: "econ.management", icon: <Briefcase className="w-5 h-5" /> },
    { id: "investment", labelKey: "econ.investment", icon: <BadgeDollarSign className="w-5 h-5" /> },
    { id: "innovation", labelKey: "econ.innovation", icon: <Lightbulb className="w-5 h-5" /> },
  ];

  const marketIndicators = [
    { label: t("econ.gdpGrowth"), value: "+3.2%", trend: "up" },
    { label: t("econ.inflation"), value: "2.8%", trend: "down" },
    { label: t("econ.tradeIndex"), value: "87.4", trend: "up" },
    { label: t("econ.investorConf"), value: "72%", trend: "up" },
  ];

  const projectIdeas = [
    { title: t("econ.idea1"), sector: t("econ.techSector"), budget: "$5K-$15K", growth: "+45%" },
    { title: t("econ.idea2"), sector: t("econ.foodSector"), budget: "$10K-$30K", growth: "+32%" },
    { title: t("econ.idea3"), sector: t("econ.eduSector"), budget: "$3K-$10K", growth: "+58%" },
    { title: t("econ.idea4"), sector: t("econ.healthSector"), budget: "$20K-$50K", growth: "+40%" },
    { title: t("econ.idea5"), sector: t("econ.energySector"), budget: "$15K-$40K", growth: "+52%" },
    { title: t("econ.idea6"), sector: t("econ.retailSector"), budget: "$8K-$25K", growth: "+28%" },
  ];

  const investmentTips = [
    { icon: <ShieldCheck className="w-6 h-6" />, titleKey: "econ.tipDiversify", descKey: "econ.tipDiversifyDesc" },
    { icon: <TrendingUp className="w-6 h-6" />, titleKey: "econ.tipResearch", descKey: "econ.tipResearchDesc" },
    { icon: <Target className="w-6 h-6" />, titleKey: "econ.tipGoals", descKey: "econ.tipGoalsDesc" },
    { icon: <Globe className="w-6 h-6" />, titleKey: "econ.tipGlobal", descKey: "econ.tipGlobalDesc" },
  ];

  return (
    <Layout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-8 md:p-12">
          <div className="max-w-6xl mx-auto text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-primary-foreground/10 rounded-2xl backdrop-blur-sm">
                <BarChart3 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                  {t("econ.title")}
                </h1>
                <p className="text-sm opacity-80 font-bold">{t("econ.subtitle")}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 -mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  speak(t(tab.labelKey), lang);
                }}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-primary shadow-lg"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
          {/* =================== FEASIBILITY =================== */}
          {activeTab === "feasibility" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
              {/* Input form */}
              <Card className="border-2 border-border rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <Calculator className="text-primary" />
                    {t("econ.feasibilityTool")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.projectName")}</label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder={t("econ.projectNamePh")}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.sector")}</label>
                    <Input
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      placeholder={t("econ.sectorPh")}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.initialBudget")}</label>
                      <Input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="$"
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.monthlyCost")}</label>
                      <Input
                        type="number"
                        value={monthlyCost}
                        onChange={(e) => setMonthlyCost(e.target.value)}
                        placeholder="$"
                        className="mt-1 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.monthlyRevenue")}</label>
                      <Input
                        type="number"
                        value={monthlyRevenue}
                        onChange={(e) => setMonthlyRevenue(e.target.value)}
                        placeholder="$"
                        className="mt-1 rounded-xl"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={analyzeFeasibility}
                    className="w-full py-5 h-auto rounded-2xl font-black text-lg gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    {t("econ.analyze")}
                  </Button>
                </CardContent>
              </Card>

              {/* Results */}
              <div className="space-y-4">
                {result ? (
                  <div className="animate-in slide-in-from-right duration-500 space-y-4">
                    <Card className="border-2 border-primary/30 rounded-3xl bg-primary/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="text-primary" />
                          {t("econ.results")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-card p-4 rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.roi")}</p>
                            <p className={`text-3xl font-black ${result.roi > 0 ? "text-primary" : "text-destructive"}`}>
                              {result.roi.toFixed(1)}%
                            </p>
                          </div>
                          <div className="bg-card p-4 rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.breakEven")}</p>
                            <p className="text-3xl font-black text-foreground">
                              {result.breakEven > 100 ? "∞" : result.breakEven}
                            </p>
                            <p className="text-xs text-muted-foreground">{t("econ.months")}</p>
                          </div>
                          <div className="bg-card p-4 rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.annualProfit")}</p>
                            <p className={`text-2xl font-black ${result.netProfit > 0 ? "text-primary" : "text-destructive"}`}>
                              ${result.netProfit.toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-card p-4 rounded-2xl border border-border text-center">
                            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.riskLevel")}</p>
                            <p className="text-xl font-black text-foreground">{result.riskLevel}</p>
                          </div>
                        </div>

                        <div className="bg-card p-4 rounded-2xl border border-primary/20">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{t("econ.recommendation")}</p>
                          <p className="font-bold text-foreground">{result.recommendation}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border-2 border-dashed border-border rounded-3xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                      <PieChart className="w-16 h-16 text-muted-foreground/30" />
                      <p className="font-bold text-muted-foreground">{t("econ.fillToAnalyze")}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Market Indicators */}
                <Card className="border-2 border-border rounded-3xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LineChart className="text-primary" />
                      {t("econ.marketIndicators")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {marketIndicators.map((ind, i) => (
                        <div key={i} className="bg-muted p-3 rounded-xl flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{ind.label}</span>
                          <div className="flex items-center gap-1">
                            <span className={`font-black text-sm ${ind.trend === "up" ? "text-primary" : "text-destructive"}`}>
                              {ind.value}
                            </span>
                            {ind.trend === "up" ? (
                              <ArrowUpRight className="w-4 h-4 text-primary" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* =================== MANAGEMENT =================== */}
          {activeTab === "management" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {[
                { icon: <Target className="w-8 h-8" />, titleKey: "econ.mgmtPlanning", descKey: "econ.mgmtPlanningDesc", progress: 75 },
                { icon: <Users className="w-8 h-8" />, titleKey: "econ.mgmtTeam", descKey: "econ.mgmtTeamDesc", progress: 60 },
                { icon: <BarChart3 className="w-8 h-8" />, titleKey: "econ.mgmtFinance", descKey: "econ.mgmtFinanceDesc", progress: 45 },
                { icon: <Globe className="w-8 h-8" />, titleKey: "econ.mgmtMarketing", descKey: "econ.mgmtMarketingDesc", progress: 30 },
                { icon: <Building2 className="w-8 h-8" />, titleKey: "econ.mgmtOps", descKey: "econ.mgmtOpsDesc", progress: 55 },
                { icon: <ShieldCheck className="w-8 h-8" />, titleKey: "econ.mgmtRisk", descKey: "econ.mgmtRiskDesc", progress: 40 },
              ].map((item, i) => (
                <Card key={i} className="border-2 border-border rounded-3xl hover:border-primary/50 transition-all cursor-pointer group">
                  <CardContent className="p-6 space-y-4">
                    <div className="p-3 bg-primary/10 rounded-2xl w-fit text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      {item.icon}
                    </div>
                    <h3 className="font-black text-lg text-foreground">{t(item.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(item.descKey)}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>{t("econ.progress")}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <Progress value={item.progress} className="h-2 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* =================== INVESTMENT =================== */}
          {activeTab === "investment" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {investmentTips.map((tip, i) => (
                  <Card key={i} className="border-2 border-border rounded-3xl">
                    <CardContent className="p-6 flex gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl h-fit text-primary shrink-0">{tip.icon}</div>
                      <div>
                        <h3 className="font-black text-foreground">{t(tip.titleKey)}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t(tip.descKey)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick calculator */}
              <Card className="border-2 border-primary/20 rounded-3xl bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="text-primary" />
                    {t("econ.investCalc")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InvestmentCalculator t={t} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* =================== INNOVATION =================== */}
          {activeTab === "innovation" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                <Lightbulb className="text-primary" />
                {t("econ.projectIdeas")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectIdeas.map((idea, i) => (
                  <Card key={i} className="border-2 border-border rounded-3xl hover:border-primary/50 transition-all group cursor-pointer">
                    <CardContent className="p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                          {idea.sector}
                        </span>
                        <span className="text-sm font-black text-primary">{idea.growth}</span>
                      </div>
                      <h3 className="font-black text-lg text-foreground">{idea.title}</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-bold">{t("econ.budgetRange")}</span>
                        <span className="font-black text-foreground">{idea.budget}</span>
                      </div>
                      <Button variant="outline" className="w-full rounded-xl font-bold gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        {t("econ.viewDetails")}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}

function InvestmentCalculator({ t }: { t: (key: string) => string }) {
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("5");

  const result = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const y = parseFloat(years) || 0;
    if (!a) return null;
    const future = a * Math.pow(1 + r / 100, y);
    const profit = future - a;
    return { future, profit };
  }, [amount, rate, years]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.investAmount")}</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" className="mt-1 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.annualRate")}</label>
          <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="%" className="mt-1 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">{t("econ.yearsCount")}</label>
          <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} placeholder="5" className="mt-1 rounded-xl" />
        </div>
      </div>
      {result && (
        <div className="grid grid-cols-2 gap-3 animate-in fade-in">
          <div className="bg-card p-4 rounded-2xl border border-border text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.futureValue")}</p>
            <p className="text-2xl font-black text-primary">${result.future.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase">{t("econ.totalProfit")}</p>
            <p className="text-2xl font-black text-primary">${result.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}
    </div>
  );
}
