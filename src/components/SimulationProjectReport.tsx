import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import {
  Trophy,
  Star,
  CheckCircle2,
  Target,
  Package,
  ArrowLeft,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import type { SimProject } from "@/data/simulationProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { AITaskPanel } from "@/components/AITaskPanel";

interface Props {
  project: SimProject;
  simulationTitle: string;
  score: number;
  pointsEarned: number;
  onRestart: () => void;
}

export function SimulationProjectReport({
  project,
  simulationTitle,
  score,
  pointsEarned,
  onRestart,
}: Props) {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";

  const clientName   = isAr ? project.clientNameAr   : project.clientName;
  const projectTitle = isAr ? project.projectTitleAr  : project.projectTitle;
  const objectives   = isAr ? project.objectivesAr    : project.objectives;
  const deliverables = isAr ? project.deliverablesAr  : project.deliverables;

  const normalizedScore = Math.min(100, Math.max(0, score));

  const getGrade = () => {
    if (normalizedScore >= 90) return { key: "outstanding", color: "text-yellow-400", emoji: "🏆" };
    if (normalizedScore >= 75) return { key: "excellent",   color: "text-green-400",  emoji: "🌟" };
    if (normalizedScore >= 60) return { key: "good",        color: "text-blue-400",   emoji: "✅" };
    if (normalizedScore >= 40) return { key: "satisfactory",color: "text-amber-400",  emoji: "📈" };
    return                            { key: "needsImprovement", color: "text-red-400", emoji: "🔁" };
  };
  const grade = getGrade();
  const gradeLabel = t(`sim.report.grade.${grade.key}`) || grade.key;

  const getFeedback = () => {
    const field = isAr ? project.tagsAr[0] : project.tags[0];
    if (normalizedScore >= 75)
      return (t("sim.report.feedbackHigh") || "").replace("{client}", clientName).replace("{field}", field);
    if (normalizedScore >= 50)
      return (t("sim.report.feedbackMid") || "").replace("{client}", clientName);
    return (t("sim.report.feedbackLow") || "").replace("{client}", clientName);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Project Completion Header */}
      <div className="text-center space-y-3">
        <div className="text-5xl">{grade.emoji}</div>
        <h1 className="text-2xl font-bold">{t("sim.report.complete")}</h1>
        <p className="text-muted-foreground text-sm">
          {clientName} · {projectTitle}
        </p>
        <Badge
          variant="outline"
          className={`text-base px-4 py-1 ${grade.color} border-current`}
        >
          {gradeLabel}
        </Badge>
      </div>

      {/* Score Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t("sim.report.performanceScore")}</span>
            </div>
            <span className="text-3xl font-bold text-primary">{normalizedScore}</span>
          </div>
          <Progress value={normalizedScore} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>{t("sim.report.pass")}</span>
            <span>100</span>
          </div>
        </CardContent>
      </Card>

      {/* Rewards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 mx-auto mb-1.5 text-yellow-500" />
            <p className="text-xl font-bold text-foreground">+{pointsEarned}</p>
            <p className="text-xs text-muted-foreground">{t("sim.report.pointsEarned")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 mx-auto mb-1.5 text-primary" />
            <p className="text-xl font-bold text-foreground">{normalizedScore}%</p>
            <p className="text-xs text-muted-foreground">{t("sim.report.projectScore")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Objectives Review */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {t("sim.report.objectivesReview")}
          </h2>
          <ul className="space-y-2.5">
            {objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    normalizedScore >= 60 ? "text-green-500" : "text-muted-foreground/40"
                  }`}
                />
                <span className="text-sm leading-snug text-muted-foreground">{obj}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Deliverables Summary */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            {t("sim.report.deliverablesSubmitted")}
          </h2>
          <ul className="space-y-2">
            {deliverables.map((del, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold text-sm shrink-0 w-5">{i + 1}.</span>
                <span className="text-sm leading-snug text-muted-foreground">{del}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Feedback message */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{getFeedback()}</p>
        </CardContent>
      </Card>

      <AITaskPanel
        assistantId="simulation-mentor"
        title={isAr ? "مراجعة المدرب الذكي" : "AI mentor review"}
        description={isAr ? "تحليل شخصي للنتيجة مع تحدٍ تالٍ مناسب." : "A personalized debrief with a focused next challenge."}
        actions={[
          { label: isAr ? "حلل أدائي" : "Analyze performance", prompt: isAr ? "حلل أدائي وحدد نقطة قوة وخطأين قابلين للتحسين." : "Analyze my performance, naming one strength and two improvements." },
          { label: isAr ? "التحدي التالي" : "Next challenge", prompt: isAr ? "اقترح تحديا عمليا تاليا يناسب نتيجتي." : "Create one practical next challenge matched to my score." },
        ]}
        context={{ simulationTitle, projectTitle, clientName, score: normalizedScore, objectives, deliverables, feedback: getFeedback() }}
        compact
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pb-6">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link to="/business-simulator">
            <ArrowLeft className="h-4 w-4" />
            {t("sim.report.back")}
          </Link>
        </Button>
        <Button onClick={onRestart} variant="outline" className="flex-1 gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("sim.report.redo")}
        </Button>
      </div>
    </div>
  );
}
