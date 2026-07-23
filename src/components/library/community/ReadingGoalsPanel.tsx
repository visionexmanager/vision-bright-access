import { useState } from "react";
import { Flame, Target, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useReadingGoals } from "@/hooks/library/useReadingGoals";
import { useReadingPlan } from "@/hooks/library/useCommunityAi";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryGoalType } from "@/services/library/readingGoals";

const GOAL_TYPES: LibraryGoalType[] = ["books_per_month", "pages_per_day", "listening_minutes_per_day", "minutes_per_day", "sessions_per_week", "custom"];

export function ReadingGoalsPanel() {
  const { t } = useLanguage();
  const { goals, streak, addGoal, removeGoal } = useReadingGoals();
  const { plan, isGenerating, generate } = useReadingPlan();
  const [open, setOpen] = useState(false);
  const [goalType, setGoalType] = useState<LibraryGoalType>("books_per_month");
  const [target, setTarget] = useState("5");
  const [customLabel, setCustomLabel] = useState("");

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className={streak > 0 ? "h-5 w-5 text-orange-500" : "h-5 w-5 text-muted-foreground"} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{t("library.goals.streakLabel").replace("{count}", String(streak))}</p>
            <p className="text-xs text-muted-foreground">{t("library.goals.title")}</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.goals.addGoal")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("library.goals.addGoal")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("library.goals.typeLabel")}</Label>
                <Select value={goalType} onValueChange={(v) => setGoalType(v as LibraryGoalType)}>
                  <SelectTrigger aria-label={t("library.goals.typeLabel")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((gt) => <SelectItem key={gt} value={gt}>{t(`library.goals.type.${gt}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {goalType === "custom" && (
                <div>
                  <Label htmlFor="goal-custom-label">{t("library.goals.customLabel")}</Label>
                  <Input id="goal-custom-label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                </div>
              )}
              <div>
                <Label htmlFor="goal-target">{t("library.goals.targetLabel")}</Label>
                <Input id="goal-target" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  await addGoal(goalType, Number(target) || 1, goalType === "custom" ? customLabel.trim() || null : null);
                  setOpen(false);
                }}
              >
                {t("library.common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Target className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.goals.empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span>{g.goal_type === "custom" ? g.custom_label : t(`library.goals.type.${g.goal_type}`)}: <strong>{g.target}</strong></span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeGoal(g.id)} aria-label={t("library.common.delete")}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t pt-3">
        {plan ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-1.5 font-medium"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.goals.planHeading")}</p>
            <p className="text-muted-foreground">{plan.planSummary}</p>
            {plan.weeklyFocus.length > 0 && (
              <ul className="list-inside list-disc text-muted-foreground">
                {plan.weeklyFocus.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
            {plan.bookSuggestionTitles.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("library.goals.planSuggestions")}: {plan.bookSuggestionTitles.join(", ")}</p>
            )}
          </div>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void generate()} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("library.goals.generatePlan")}
          </Button>
        )}
      </div>
    </Card>
  );
}
