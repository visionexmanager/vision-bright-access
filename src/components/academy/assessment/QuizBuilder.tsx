import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { TagInput } from "@/components/academy/ui/TagInput";
import type { AcademyQuizRow, AcademyQuizQuestionRow, AcademyQuizQuestionType } from "@/lib/types/academy-lms";

const TYPE_LABELS: Record<AcademyQuizQuestionType, string> = {
  single_choice: "اختيار واحد", multiple_choice: "اختيار متعدد", true_false: "صح / خطأ",
  short_answer: "إجابة قصيرة", essay: "سؤال مقالي", code: "سؤال برمجي",
};

function blankQuestion(orderIndex: number): AcademyQuizQuestionRow {
  return {
    id: `q-${crypto.randomUUID()}`, quiz_id: "", order_index: orderIndex, type: "single_choice",
    prompt: "", choices: ["", ""], correct_choice_indexes: [], accepted_answers: [],
    code_starter: null, code_language: null, points: 10, difficulty: "medium", explanation: null,
  };
}

interface QuizBuilderProps {
  initialQuiz?: AcademyQuizRow;
  initialQuestions?: AcademyQuizQuestionRow[];
  onSave: (quiz: Partial<AcademyQuizRow>, questions: AcademyQuizQuestionRow[]) => void;
}

export function QuizBuilder({ initialQuiz, initialQuestions, onSave }: QuizBuilderProps) {
  const [title, setTitle] = useState(initialQuiz?.title ?? "");
  const [passingScore, setPassingScore] = useState(initialQuiz?.passing_score_percent ?? 70);
  const [timeLimit, setTimeLimit] = useState(initialQuiz?.time_limit_minutes ?? 10);
  const [attemptsLimit, setAttemptsLimit] = useState(initialQuiz?.attempts_limit ?? 3);
  const [randomize, setRandomize] = useState(initialQuiz?.randomize_questions ?? false);
  const [instantFeedback, setInstantFeedback] = useState(initialQuiz?.instant_feedback ?? true);
  const [scope, setScope] = useState(initialQuiz?.scope ?? "lesson");
  const [questions, setQuestions] = useState<AcademyQuizQuestionRow[]>(initialQuestions?.length ? initialQuestions : [blankQuestion(1)]);

  const updateQuestion = (id: string, updates: Partial<AcademyQuizQuestionRow>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };
  const addQuestion = () => setQuestions((prev) => [...prev, blankQuestion(prev.length + 1)]);
  const removeQuestion = (id: string) => setQuestions((prev) => prev.filter((q) => q.id !== id));
  const moveQuestion = (id: string, dir: -1 | 1) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    onSave(
      { title, passing_score_percent: passingScore, time_limit_minutes: timeLimit || null, attempts_limit: attemptsLimit || null, randomize_questions: randomize, instant_feedback: instantFeedback, scope },
      questions
    );
  };

  return (
    <div className="space-y-5">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الاختبار" className="rounded-xl" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">نطاق الاختبار</label>
          <Select value={scope} onValueChange={(v) => setScope(v as AcademyQuizRow["scope"])}>
            <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lesson">اختبار درس</SelectItem>
              <SelectItem value="module">اختبار وحدة</SelectItem>
              <SelectItem value="final_exam">الاختبار النهائي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">الحد الأدنى للنجاح %</label>
          <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="rounded-xl mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">الوقت (دقائق، 0=بلا حد)</label>
          <Input type="number" min={0} value={timeLimit ?? 0} onChange={(e) => setTimeLimit(Number(e.target.value))} className="rounded-xl mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">المحاولات (0=بلا حد)</label>
          <Input type="number" min={0} value={attemptsLimit ?? 0} onChange={(e) => setAttemptsLimit(Number(e.target.value))} className="rounded-xl mt-1" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} className="w-4 h-4" />
          ترتيب عشوائي للأسئلة
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={instantFeedback} onChange={(e) => setInstantFeedback(e.target.checked)} className="w-4 h-4" />
          إظهار التغذية الراجعة الفورية
        </label>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground shrink-0">س{i + 1}</span>
              <Input value={q.prompt} onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })} placeholder="نص السؤال" className="rounded-xl flex-1" />
              <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, { type: v as AcademyQuizQuestionType, choices: v === "true_false" ? ["صح", "خطأ"] : q.choices })}>
                <SelectTrigger className="w-40 rounded-xl shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={0} value={q.points} onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })} className="w-20 rounded-xl shrink-0" aria-label="النقاط" />
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveQuestion(q.id, -1)} aria-label="نقل لأعلى"><ChevronUp className="w-4 h-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveQuestion(q.id, 1)} aria-label="نقل لأسفل"><ChevronDown className="w-4 h-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeQuestion(q.id)} aria-label="حذف السؤال"><Trash2 className="w-4 h-4" /></Button>
            </div>

            {(q.type === "single_choice" || q.type === "multiple_choice" || q.type === "true_false") && (
              <div className="space-y-1.5 ps-6">
                {q.choices.map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                      checked={q.correct_choice_indexes.includes(ci)}
                      onChange={(e) => {
                        const isMulti = q.type === "multiple_choice";
                        const next = isMulti
                          ? (e.target.checked ? [...q.correct_choice_indexes, ci] : q.correct_choice_indexes.filter((x) => x !== ci))
                          : [ci];
                        updateQuestion(q.id, { correct_choice_indexes: next });
                      }}
                      aria-label={`الخيار ${ci + 1} صحيح`}
                    />
                    <Input
                      value={choice}
                      onChange={(e) => updateQuestion(q.id, { choices: q.choices.map((c, idx) => (idx === ci ? e.target.value : c)) })}
                      disabled={q.type === "true_false"}
                      className="rounded-xl flex-1 h-9 text-sm"
                    />
                    {q.type !== "true_false" && q.choices.length > 2 && (
                      <button type="button" onClick={() => updateQuestion(q.id, { choices: q.choices.filter((_, idx) => idx !== ci) })} className="text-muted-foreground hover:text-destructive" aria-label="حذف الخيار">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {q.type !== "true_false" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateQuestion(q.id, { choices: [...q.choices, ""] })} className="gap-1 text-xs">
                    <Plus className="w-3 h-3" aria-hidden="true" />إضافة خيار
                  </Button>
                )}
              </div>
            )}

            {q.type === "short_answer" && (
              <div className="ps-6">
                <TagInput values={q.accepted_answers} onChange={(v) => updateQuestion(q.id, { accepted_answers: v })} placeholder="أضف إجابة مقبولة" />
              </div>
            )}

            {q.type === "code" && (
              <div className="ps-6 grid grid-cols-2 gap-2">
                <Input value={q.code_language ?? ""} onChange={(e) => updateQuestion(q.id, { code_language: e.target.value })} placeholder="اللغة (مثال: python)" className="rounded-xl h-9 text-sm" />
                <Input value={q.code_starter ?? ""} onChange={(e) => updateQuestion(q.id, { code_starter: e.target.value })} placeholder="كود ابتدائي (اختياري)" className="rounded-xl h-9 text-sm font-mono" dir="ltr" />
              </div>
            )}

            <Textarea value={q.explanation ?? ""} onChange={(e) => updateQuestion(q.id, { explanation: e.target.value || null })} placeholder="شرح الإجابة (اختياري، يظهر بعد الحل)" className="rounded-xl text-sm min-h-16 ms-6" />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addQuestion} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة سؤال
        </Button>
      </div>

      <Button onClick={handleSave} disabled={!title.trim() || questions.length === 0} className="rounded-xl">حفظ الاختبار</Button>
    </div>
  );
}
