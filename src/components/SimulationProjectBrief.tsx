import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Target, Clock, Wallet, CheckCircle2, Package, Building2 } from "lucide-react";
import type { SimProject } from "@/data/simulationProjects";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  project: SimProject;
  simulationTitle: string;
  difficulty: string;
  estimatedDuration: number;
  onStart: () => void;
}

const difficultyColor = (d: string) => {
  if (d === "Beginner") return "bg-green-600/20 text-green-400 border-green-600/30";
  if (d === "Intermediate") return "bg-yellow-600/20 text-yellow-400 border-yellow-600/30";
  return "bg-red-600/20 text-red-400 border-red-600/30";
};

export function SimulationProjectBrief({
  project,
  simulationTitle,
  difficulty,
  estimatedDuration,
  onStart,
}: Props) {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";

  const clientName   = isAr ? project.clientNameAr   : project.clientName;
  const projectTitle = isAr ? project.projectTitleAr  : project.projectTitle;
  const scenario     = isAr ? project.scenarioAr      : project.scenario;
  const objectives   = isAr ? project.objectivesAr    : project.objectives;
  const deliverables = isAr ? project.deliverablesAr  : project.deliverables;
  const tags         = isAr ? project.tagsAr          : project.tags;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl leading-none">{project.clientLogo}</div>
        <div className="flex items-center justify-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{clientName}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{projectTitle}</h1>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge className={difficultyColor(difficulty)} variant="outline">
            {t(`cat.${difficulty}`) || difficulty}
          </Badge>
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Project Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <Wallet className="h-5 w-5 mx-auto mb-1.5 text-green-500" />
            <p className="text-sm font-semibold text-foreground">{project.budget}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("sim.brief.budget")}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1.5 text-blue-500" />
            <p className="text-sm font-semibold text-foreground">{project.timeline}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("sim.brief.timeline")}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <p className="text-sm font-semibold text-foreground">{estimatedDuration} min</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("sim.brief.duration")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Brief / Scenario */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-2 flex items-center gap-2">
            {t("sim.brief.heading")}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{scenario}</p>
        </CardContent>
      </Card>

      {/* Objectives */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {t("sim.brief.objectives")}
          </h2>
          <ul className="space-y-2.5">
            {objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm leading-snug">{obj}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            {t("sim.brief.deliverables")}
          </h2>
          <ul className="space-y-2">
            {deliverables.map((del, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold text-sm shrink-0 w-5">{i + 1}.</span>
                <span className="text-sm leading-snug">{del}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Start CTA */}
      <div className="text-center pt-2 pb-6">
        <Button onClick={onStart} size="lg" className="gap-2 px-12 text-base">
          {t("sim.brief.begin")}
          <ArrowRight className="h-5 w-5" />
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {t("sim.brief.autoSave")}
        </p>
      </div>
    </div>
  );
}
