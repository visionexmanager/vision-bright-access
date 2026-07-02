import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { AcademyProjectRow, AcademyProjectSubmissionMethod } from "@/lib/types/academy-lms";

function EditableList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))} className="rounded-xl" />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="حذف السطر"><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])} className="gap-1.5 rounded-xl">
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />{placeholder}
      </Button>
    </div>
  );
}

interface ProjectBuilderProps {
  initial?: AcademyProjectRow;
  onSave: (data: Partial<AcademyProjectRow>) => void;
}

export function ProjectBuilder({ initial, onSave }: ProjectBuilderProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [brief, setBrief] = useState(initial?.brief_markdown ?? "");
  const [requirements, setRequirements] = useState<string[]>(initial?.requirements ?? []);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [submissionMethod, setSubmissionMethod] = useState<AcademyProjectSubmissionMethod>(initial?.submission_method ?? "repo_url");
  const [rubric, setRubric] = useState<Array<{ criterion: string; max_points: number }>>(initial?.rubric ?? []);

  const addCriterion = () => setRubric((prev) => [...prev, { criterion: "", max_points: 10 }]);
  const updateCriterion = (i: number, updates: Partial<{ criterion: string; max_points: number }>) => {
    setRubric((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...updates } : r)));
  };
  const removeCriterion = (i: number) => setRubric((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    onSave({
      title, description, brief_markdown: brief, requirements: requirements.filter((r) => r.trim()),
      steps: steps.filter((s) => s.trim()), submission_method: submissionMethod, rubric, resources: initial?.resources ?? [],
    });
  };

  return (
    <div className="space-y-4">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المشروع" className="rounded-xl" />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف موجز للمشروع" className="rounded-xl min-h-16" />
      <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="تفاصيل المشروع (Markdown مدعوم)" className="rounded-xl min-h-28" />

      <div>
        <p className="text-xs font-bold text-muted-foreground mb-2">المتطلبات</p>
        <EditableList items={requirements} onChange={setRequirements} placeholder="إضافة متطلب" />
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground mb-2">خطوات العمل</p>
        <EditableList items={steps} onChange={setSteps} placeholder="إضافة خطوة" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">طريقة التسليم</label>
        <Select value={submissionMethod} onValueChange={(v) => setSubmissionMethod(v as AcademyProjectSubmissionMethod)}>
          <SelectTrigger className="rounded-xl mt-1 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="repo_url">رابط مستودع (GitHub)</SelectItem>
            <SelectItem value="file_upload">رفع ملف</SelectItem>
            <SelectItem value="live_url">رابط مباشر للمشروع</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      <Button onClick={handleSave} disabled={!title.trim()} className="rounded-xl">حفظ المشروع</Button>
    </div>
  );
}
