import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Clock,
  Rocket,
  ArrowRight,
  Gamepad2,
  BarChart3,
} from "lucide-react";

type Simulation = {
  id: string;
  title: string;
  description: string;
  subcategory: string;
  slug: string;
  points: number;
  difficulty: string;
  estimated_duration: number;
};

export default function BusinessSimulator() {
  const { t } = useLanguage();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("simulations")
        .select("*")
        .eq("published", true)
        .order("sort_order");
      if (data) setSimulations(data as Simulation[]);
      setLoading(false);
    };
    load();
  }, []);

  // Derive subcategories from data
  const subcategories = Array.from(new Set(simulations.map((s) => s.subcategory))).sort();
  const filtered =
    activeTab === "all"
      ? simulations
      : simulations.filter((s) => s.subcategory === activeTab);

  const difficultyColor: Record<string, string> = {
    Beginner: "bg-green-500/10 text-green-700 dark:text-green-400",
    Intermediate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    Advanced: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="bsim-heading">
        {/* Hero */}
        <div className="mb-10 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 md:p-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-primary/20 p-3">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <Badge variant="secondary" className="text-sm">
              <Gamepad2 className="mr-1 h-3.5 w-3.5" />
              {t("bsim.badge")}
            </Badge>
          </div>
          <h1 id="bsim-heading" className="mb-3 text-3xl font-bold md:text-4xl">
            {t("bsim.title")}
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
            {t("bsim.description")}
          </p>
        </div>

        {/* Tabs for subcategories */}
        {subcategories.length > 1 && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-8 flex flex-wrap gap-1">
              <TabsTrigger value="all" className="text-base">
                {t("content.tab.all")}
              </TabsTrigger>
              {subcategories.map((sc) => (
                <TabsTrigger key={sc} value={sc} className="text-base">
                  {sc}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Simulation cards */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Rocket className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {t("bsim.empty")}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {t("bsim.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sim) => (
              <Card
                key={sim.id}
                className="group flex flex-col transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <CardContent className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <BarChart3 className="h-7 w-7 text-primary" />
                    </div>
                    <Badge className="text-sm">+{sim.points} pts</Badge>
                  </div>

                  <h2 className="text-lg font-bold leading-tight">{sim.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {sim.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{sim.subcategory}</Badge>
                    <Badge
                      variant="outline"
                      className={difficultyColor[sim.difficulty] || ""}
                    >
                      {sim.difficulty}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{sim.estimated_duration} min</span>
                  </div>

                  <div className="mt-auto pt-2">
                    <Button asChild className="w-full text-base font-semibold group-hover:gap-3 transition-all">
                      <Link to={`/business-simulator/${sim.slug}`}>
                        <Rocket className="h-4 w-4" />
                        {t("bsim.start")}
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
