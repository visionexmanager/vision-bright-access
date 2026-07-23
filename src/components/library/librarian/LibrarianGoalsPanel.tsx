import { useState } from "react";
import { Plus, X, Check, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { ReadingGoalsPanel } from "@/components/library/community/ReadingGoalsPanel";
import { useLibrarianGoals } from "@/hooks/library/useLibrarianGoals";
import type { LibraryLibrarianGoalCategory } from "@/services/library/librarianGoals";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES: LibraryLibrarianGoalCategory[] = ["learning", "study", "career", "custom"];

export function LibrarianGoalsPanel() {
  const { t } = useLanguage();
  const { goals, addGoal, setStatus, removeGoal } = useLibrarianGoals();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<LibraryLibrarianGoalCategory>("learning");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const activeGoals = goals.filter((g) => g.status === "active");

  return (
    <div className="space-y-4">
      <ReadingGoalsPanel />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Target className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.goals.qualitativeTitle")}</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.librarian.goals.addGoal")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.librarian.goals.addGoal")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("library.librarian.goals.category")}</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as LibraryLibrarianGoalCategory)}>
                    <SelectTrigger aria-label={t("library.librarian.goals.category")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`library.librarian.goals.category.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lg-title">{t("library.librarian.goals.titleLabel")}</Label>
                  <Input id="lg-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lg-desc">{t("library.librarian.goals.descriptionLabel")}</Label>
                  <Textarea id="lg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!title.trim()}
                  onClick={() => { void addGoal(category, title, description); setOpen(false); setTitle(""); setDescription(""); }}
                >
                  {t("library.librarian.goals.addGoal")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {activeGoals.length === 0 ? (
          <EmptyState icon={<Target className="h-8 w-8" />} title={t("library.librarian.goals.empty")} className="py-6" />
        ) : (
          <ul className="space-y-2">
            {activeGoals.map((g) => (
              <li key={g.id}>
                <Card className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">{t(`library.librarian.goals.category.${g.goal_category}`)}</Badge>
                      <span className="text-sm font-medium">{g.title}</span>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void setStatus(g.id, "completed")} aria-label={t("library.librarian.goals.markComplete")}>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeGoal(g.id)} aria-label={t("library.reviews.delete")}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
