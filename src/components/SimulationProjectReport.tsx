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

interface Props {
  project: SimProject;
  simulationTitle: string;
  score: number;
  pointsEarned: number;
  onRestart: () => void;
}

function getGrade(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: "Outstanding", color: "text-yellow-400", emoji: "🏆" };
  if (score >= 75) return { label: "Excellent", color: "text-green-400", emoji: "🌟" };
  if (score >= 60) return { label: "Good", color: "text-blue-400", emoji: "✅" };
  if (score >= 40) return { label: "Satisfactory", color: "text-amber-400", emoji: "📈" };
  return { label: "Needs Improvement", color: "text-red-400", emoji: "🔁" };
}

export function SimulationProjectReport({
  project,
  simulationTitle,
  score,
  pointsEarned,
  onRestart,
}: Props) {
  const grade = getGrade(score);
  const normalizedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Project Completion Header */}
      <div className="text-center space-y-3">
        <div className="text-5xl">{grade.emoji}</div>
        <h1 className="text-2xl font-bold">Project Complete!</h1>
        <p className="text-muted-foreground text-sm">
          {project.clientName} · {project.projectTitle}
        </p>
        <Badge
          variant="outline"
          className={`text-base px-4 py-1 ${grade.color} border-current`}
        >
          {grade.label}
        </Badge>
      </div>

      {/* Score Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Performance Score</span>
            </div>
            <span className="text-3xl font-bold text-primary">{normalizedScore}</span>
          </div>
          <Progress value={normalizedScore} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>Pass (60)</span>
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
            <p className="text-xs text-muted-foreground">VX Points Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 mx-auto mb-1.5 text-primary" />
            <p className="text-xl font-bold text-foreground">{normalizedScore}%</p>
            <p className="text-xs text-muted-foreground">Project Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Objectives Review */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Objectives Review
          </h2>
          <ul className="space-y-2.5">
            {project.objectives.map((obj, i) => (
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
            Deliverables Submitted
          </h2>
          <ul className="space-y-2">
            {project.deliverables.map((del, i) => (
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
          <p className="text-sm text-muted-foreground leading-relaxed">
            {normalizedScore >= 75
              ? `${project.clientName} is highly satisfied with your project execution. Your performance demonstrates strong professional capability in ${project.tags[0]}.`
              : normalizedScore >= 50
              ? `${project.clientName} accepts the project with minor reservations. Review the objectives and consider replaying to improve your score.`
              : `${project.clientName} has requested revisions. Study the project brief carefully and retry to meet the required standards.`}
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pb-6">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link to="/business-simulator">
            <ArrowLeft className="h-4 w-4" />
            Back to Simulations
          </Link>
        </Button>
        <Button onClick={onRestart} variant="outline" className="flex-1 gap-2">
          <RotateCcw className="h-4 w-4" />
          Redo Project
        </Button>
      </div>
    </div>
  );
}
