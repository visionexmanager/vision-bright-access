import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, Clock, Trophy, ArrowRight, BarChart3 } from "lucide-react";

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
  const [simulations, setSimulations] = useState<SimRow[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRow>>({});
  const [loading, setLoading] = useState(true);

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

  const completedCount = Object.values(progressMap).filter((p) => p.completed).length;
  const totalPoints = Object.values(progressMap).reduce((s, p) => s + p.score, 0);
  const overallProgress = simulations.length ? Math.round((completedCount / simulations.length) * 100) : 0;

  // Group by subcategory
  const groups: Record<string, SimRow[]> = {};
  simulations.forEach((s) => {
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
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            {t("summary.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("summary.subtitle")}</p>
        </div>

        {/* Overview cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-primary/20">
            <CardContent className="flex items-center gap-4 p-5">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{overallProgress}%</p>
                <p className="text-sm text-muted-foreground">{t("summary.overall")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
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
          <Card className="border-primary/20">
            <CardContent className="flex items-center gap-4 p-5">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">{totalPoints}</p>
                <p className="text-sm text-muted-foreground">{t("summary.points")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress bar */}
        <div className="mb-10">
          <Progress value={overallProgress} className="h-3" />
        </div>

        {/* Grouped simulations */}
        {Object.entries(groups).map(([category, sims]) => (
          <div key={category} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-foreground">{category}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sims.map((sim) => {
                const prog = progressMap[sim.id];
                const done = prog?.completed;
                return (
                  <Card
                    key={sim.id}
                    className={`transition-all hover:shadow-md ${done ? "border-green-500/40 bg-green-500/5" : ""}`}
                  >
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
                        {prog && !done && (
                          <Badge variant="secondary" className="text-xs">
                            {t("summary.inProgress")} — {prog.score} pts
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3">
                        <Button asChild size="sm" variant={done ? "outline" : "default"}>
                          <Link to={`/business-simulator/${sim.slug}`}>
                            {done ? t("summary.replay") : t("summary.start")}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
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
