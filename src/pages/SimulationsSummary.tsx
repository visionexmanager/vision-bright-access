import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, Clock, Trophy, ArrowRight, BarChart3, Search, Filter, ArrowUpDown, Coins } from "lucide-react";
import { simulationImages } from "@/data/simulationImages";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { SIMULATION_PRICES, formatVX } from "@/systems/pricingSystem";
import { useVXWallet } from "@/hooks/useVXWallet";
import { toast } from "@/hooks/use-toast";

interface SimRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  estimated_duration: number;
  subcategory: string;
}

interface ProgressRow {
  simulation_id: string;
  completed: boolean;
  score: number;
  current_step: number;
}

export default function SimulationsSummary() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { spendVX } = useVXWallet();
  const [simulations, setSimulations] = useState<SimRow[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeDifficulty, setActiveDifficulty] = useState("all");
  const [sortBy, setSortBy] = useState<"default" | "points" | "duration" | "newest">("default");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: sims } = await supabase
        .from("simulations")
        .select("*")
        .eq("published", true)
        .order("sort_order");

      if (sims) setSimulations(sims);

      if (user) {
        const { data: prog } = await supabase
          .from("simulation_progress")
          .select("simulation_id, completed, score, current_step")
          .eq("user_id", user.id);

        if (prog) {
          const map: Record<string, ProgressRow> = {};
          prog.forEach((p) => (map[p.simulation_id] = p));
          setProgressMap(map);
        }
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const subcategories = useMemo(() => Array.from(new Set(simulations.map((s) => s.subcategory))).sort(), [simulations]);
  const difficulties = useMemo(() => Array.from(new Set(simulations.map((s) => s.difficulty))), [simulations]);

  const filtered = useMemo(() => {
    let result = simulations.filter((s) => {
      const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "all" || s.subcategory === activeCategory;
      const matchDiff = activeDifficulty === "all" || s.difficulty === activeDifficulty;
      return matchSearch && matchCat && matchDiff;
    });
    if (sortBy === "points") result = [...result].sort((a, b) => b.points - a.points);
    else if (sortBy === "duration") result = [...result].sort((a, b) => a.estimated_duration - b.estimated_duration);
    else if (sortBy === "newest") result = [...result].sort((a, b) => (b.id > a.id ? 1 : -1));
    return result;
  }, [simulations, search, activeCategory, activeDifficulty, sortBy]);

  const completedCount = Object.values(progressMap).filter((p) => p.completed).length;
  const totalPoints = Object.values(progressMap).reduce((s, p) => s + p.score, 0);
  const overallProgress = simulations.length ? Math.round((completedCount / simulations.length) * 100) : 0;

  // Group filtered by subcategory
  const groups: Record<string, SimRow[]> = {};
  filtered.forEach((s) => {
    if (!groups[s.subcategory]) groups[s.subcategory] = [];
    groups[s.subcategory].push(s);
  });

  const difficultyColor = (d: string) => {
    if (d === "Beginner") return "bg-green-600/20 text-green-400 border-green-600/30";
    if (d === "Intermediate") return "bg-yellow-600/20 text-yellow-400 border-yellow-600/30";
    return "bg-red-600/20 text-red-400 border-red-600/30";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="container mx-auto max-w-5xl px-4 py-10">
        <AnimatedSection variants={scaleFade}>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            {t("summary.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("summary.subtitle")}</p>
        </div>
        </AnimatedSection>

        {/* Overview cards */}
        <StaggerGrid className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StaggerItem>
          <Card className="border-primary/20 transition-transform duration-200 hover:scale-105">
            <CardContent className="flex items-center gap-4 p-5">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{overallProgress}%</p>
                <p className="text-sm text-muted-foreground">{t("summary.overall")}</p>
              </div>
            </CardContent>
          </Card>
          </StaggerItem>
          <StaggerItem>
          <Card className="border-primary/20 transition-transform duration-200 hover:scale-105">
            <CardContent className="flex items-center gap-4 p-5">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {completedCount}/{simulations.length}
                </p>
                <p className="text-sm text-muted-foreground">{t("summary.completed")}</p>
              </div>
            </CardContent>
          </Card>
          </StaggerItem>
          <StaggerItem>
          <Card className="border-primary/20 transition-transform duration-200 hover:scale-105">
            <CardContent className="flex items-center gap-4 p-5">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">{totalPoints}</p>
                <p className="text-sm text-muted-foreground">{t("summary.points")}</p>
              </div>
            </CardContent>
          </Card>
          </StaggerItem>
        </StaggerGrid>

        {/* Progress bar */}
        <AnimatedSection>
        <div className="mb-10">
          <Progress value={overallProgress} className="h-3" />
        </div>
        </AnimatedSection>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("simulations.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" />
              {t("simulations.category")}:
            </div>
            <Button size="sm" variant={activeCategory === "all" ? "default" : "outline"} onClick={() => setActiveCategory("all")}>
              {t("content.tab.all")}
            </Button>
            {subcategories.map((cat) => (
              <Button key={cat} size="sm" variant={activeCategory === cat ? "default" : "outline"} onClick={() => setActiveCategory(cat)}>
                {cat} ({simulations.filter((s) => s.subcategory === cat).length})
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" />
              {t("simulations.difficulty")}:
            </div>
            <Button size="sm" variant={activeDifficulty === "all" ? "default" : "outline"} onClick={() => setActiveDifficulty("all")}>
              {t("content.tab.all")}
            </Button>
            {difficulties.map((diff) => (
              <Button key={diff} size="sm" variant={activeDifficulty === diff ? "default" : "outline"} onClick={() => setActiveDifficulty(diff)}>
                {diff} ({simulations.filter((s) => s.difficulty === diff).length})
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mr-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {t("simulations.sortBy")}:
            </div>
            <Button size="sm" variant={sortBy === "default" ? "default" : "outline"} onClick={() => setSortBy("default")}>
              {t("simulations.sortDefault")}
            </Button>
            <Button size="sm" variant={sortBy === "points" ? "default" : "outline"} onClick={() => setSortBy("points")}>
              {t("simulations.sortPoints")}
            </Button>
            <Button size="sm" variant={sortBy === "duration" ? "default" : "outline"} onClick={() => setSortBy("duration")}>
              {t("simulations.sortDuration")}
            </Button>
            <Button size="sm" variant={sortBy === "newest" ? "default" : "outline"} onClick={() => setSortBy("newest")}>
              {t("simulations.sortNewest")}
            </Button>
          </div>
        </div>

        {/* Grouped simulations */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-lg font-medium text-muted-foreground">{t("simulations.noResults")}</p>
          </div>
        )}
        {Object.entries(groups).map(([category, sims]) => (
          <AnimatedSection key={category} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-foreground">{category}</h2>
            <StaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sims.map((sim) => {
                const prog = progressMap[sim.id];
                const done = prog?.completed;
                return (
                  <StaggerItem key={sim.id}>
                  <Card
                    className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${done ? "border-green-500/40 bg-green-500/5" : ""}`}
                  >
                    {simulationImages[sim.slug] && (
                      <div className="relative h-32 w-full overflow-hidden">
                        <img
                          src={simulationImages[sim.slug]}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          width={768}
                          height={512}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      </div>
                    )}
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{sim.title}</h3>
                            {done && <CheckCircle className="h-5 w-5 text-green-500" />}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {sim.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge className={difficultyColor(sim.difficulty)} variant="outline">
                          {sim.difficulty}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {sim.estimated_duration} min
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="h-3 w-3" /> {sim.points} pts
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Coins className="h-3 w-3" /> {formatVX(SIMULATION_PRICES.singleSession)}
                        </span>
                        {prog && !done && (
                          <Badge variant="secondary" className="text-xs">
                            {t("summary.inProgress")} — {prog.score} pts
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant={done ? "outline" : "default"}
                          className="group-hover:gap-3 transition-all"
                          onClick={async () => {
                            if (!user) {
                              navigate("/login");
                              return;
                            }
                            if (!done) {
                              const ok = await spendVX(SIMULATION_PRICES.singleSession, "simulation", sim.title, sim.id);
                              if (!ok) return;
                              toast({ title: t("vx.purchaseSuccess"), description: t("vx.deducted").replace("{amount}", SIMULATION_PRICES.singleSession.toLocaleString()) });
                            }
                            navigate(`/business-simulator/${sim.slug}`);
                          }}
                        >
                          {done ? t("summary.replay") : t("summary.start")}
                          <ArrowRight className="ml-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </AnimatedSection>
        ))}

        {!user && (
          <Card className="border-primary/30">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t("summary.loginPrompt")}</p>
              <Button asChild className="mt-3">
                <Link to="/login">{t("nav.login")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
