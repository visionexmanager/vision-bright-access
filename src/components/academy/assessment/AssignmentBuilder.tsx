import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { AcademyAssignmentRow, AcademyAssignmentType } from "@/lib/types/academy-lms";

const TYPE_LABELS: Record<AcademyAssignmentType, string> = {
  written: "إجابة كتابية", file_upload: "رفع ملف", coding: "مهمة برمجية", research: "مهمة بحثية", problem_solving: "حل مسألة",
};

interface AssignmentBuilderProps {
  initial?: AcademyAssignmentRow;
  onSave: (data: Partial<AcademyAssignmentRow>) => void;
}

export function AssignmentBuilder({ initial, onSave }: AssignmentBuilderProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions_markdown ?? "");
  const [type, setType] = useState<AcademyAssignmentType>(initial?.type ?? "written");
  const [maxScore, setMaxScore] = useState(initial?.max_score ?? 100);
  const [dueOffsetDays, setDueOffsetDays] = useState(initial?.due_offset_days ?? 14);
  const [allowResubmission, setAllowResubmission] = useState(initial?.allow_resubmission ?? true);
  const [rubric, setRubric] = useState<Array<{ criterion: string; max_points: number }>>(initial?.rubric ?? []);

  const addCriterion = () => setRubric((prev) => [...prev, { criterion: "", max_points: 10 }]);
  const updateCriterion = (i: number, updates: Partial<{ criterion: string; max_points: number }>) => {
    setRubric((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...updates } : r)));
  };
  const removeCriterion = (i: number) => setRubric((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    onSave({
      title, instructions_markdown: instructions, type, max_score: maxScore,
      due_offset_days: dueOffsetDays || null, allow_resubmission: allowResubmission, rubric,
    });
  };

  return (
    <div className="space-y-4">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الواجب" className="rounded-xl" />
      <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="تعليمات الواجب (Markdown مدعوم)" className="rounded-xl min-h-28" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">نوع الواجب</label>
          <Select value={type} onValueChange={(v) => setType(v as AcademyAssignmentType)}>
            <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">الدرجة القصوى</label>
          <Input type="number" min={0} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="rounded-xl mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">الموعد النهائي (أيام بعد التسجيل)</label>
          <Input type="number" min={0} value={dueOffsetDays ?? 0} onChange={(e) => setDueOffsetDays(Number(e.target.value))} className="rounded-xl mt-1" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input type="checkbox" checked={allowResubmission} onChange={(e) => setAllowResubmission(e.target.checked)} className="w-4 h-4" />
        السماح بإعادة التسليم
      </label>

      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground">معايير التقييم (Rubric)</p>
        {rubric.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={r.criterion} onChange={(e) => updateCriterion(i, { criterion: e.target.value })} placeholder="المعيار" className="rounded-xl flex-1" />
            <Input type="number" min={0} value={r.max_points} onChange={(e) => updateCriterion(i, { max_points: Number(e.target.value) })} className="rounded-xl w-24" aria-label="النقاط القصوى" />
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeCriterion(i)} aria-label="حذف المعيار"><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addCriterion} className="gap-1.5 rounded-xl">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />إضافة معيار
        </Button>
      </div>

      <Button onClick={handleSave} disabled={!title.trim()} className="rounded-xl">حفظ الواجب</Button>
    </div>
  );
}
