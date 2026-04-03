import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  BrainCircuit, ArrowRight, ArrowLeft, Loader2, RotateCcw,
  Sparkles, CheckCircle2, Target, History, Trash2, Save, Clock
} from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-chat`;

interface StudentProfile {
  name: string;
  gender: "male" | "female";
  country: string;
  level: string;
}

interface Question {
  id: number;
  text: string;
  category: string;
  options: { label: string; value: string }[];
}

const questions: Question[] = [
  {
    id: 1, category: "personality", text: "كيف تفضل قضاء وقت فراغك؟",
    options: [
      { label: "قراءة كتب أو مقالات علمية", value: "analytical" },
      { label: "رسم أو تصميم أو عزف موسيقى", value: "creative" },
      { label: "ممارسة رياضة أو نشاط بدني", value: "physical" },
      { label: "التحدث مع الأصدقاء ومساعدة الآخرين", value: "social" },
    ],
  },
  {
    id: 2, category: "skills", text: "ما المادة الدراسية التي تستمتع بها أكثر؟",
    options: [
      { label: "الرياضيات والعلوم", value: "stem" },
      { label: "اللغات والأدب", value: "humanities" },
      { label: "الفنون والتصميم", value: "arts" },
      { label: "الاقتصاد وإدارة الأعمال", value: "business" },
    ],
  },
  {
    id: 3, category: "workstyle", text: "كيف تفضل العمل؟",
    options: [
      { label: "بمفردي وبتركيز عميق", value: "independent" },
      { label: "ضمن فريق وأتعاون مع الآخرين", value: "team" },
      { label: "أقود فريقاً وأتخذ القرارات", value: "leader" },
      { label: "أنفذ مهام عملية بيدي", value: "hands-on" },
    ],
  },
  {
    id: 4, category: "values", text: "ما الأهم بالنسبة لك في مهنة المستقبل؟",
    options: [
      { label: "راتب عالي واستقرار مادي", value: "financial" },
      { label: "مساعدة الناس وخدمة المجتمع", value: "service" },
      { label: "الإبداع والابتكار", value: "innovation" },
      { label: "الحرية والمرونة في العمل", value: "freedom" },
    ],
  },
  {
    id: 5, category: "interests", text: "أي من هذه المشاريع يثير حماسك أكثر؟",
    options: [
      { label: "بناء تطبيق أو موقع إلكتروني", value: "tech" },
      { label: "تصميم منتج أو علامة تجارية", value: "design" },
      { label: "إجراء تجربة علمية أو بحث", value: "research" },
      { label: "تنظيم حدث أو إدارة مشروع", value: "management" },
    ],
  },
  {
    id: 6, category: "problemSolving", text: "عندما تواجه مشكلة صعبة، ماذا تفعل؟",
    options: [
      { label: "أحللها خطوة بخطوة بالمنطق", value: "logical" },
      { label: "أبحث عن حلول إبداعية غير تقليدية", value: "creative" },
      { label: "أطلب المساعدة وأتناقش مع الآخرين", value: "collaborative" },
      { label: "أجرب حلولاً عملية مباشرة", value: "practical" },
    ],
  },
  {
    id: 7, category: "environment", text: "أين تتخيل نفسك تعمل في المستقبل؟",
    options: [
      { label: "في مكتب أو شركة تقنية", value: "office" },
      { label: "في مستشفى أو عيادة", value: "medical" },
      { label: "في استوديو أو ورشة إبداعية", value: "studio" },
      { label: "في الهواء الطلق أو أسافر كثيراً", value: "outdoor" },
    ],
  },
  {
    id: 8, category: "motivation", text: "ما الذي يحفزك أكثر للتعلم؟",
    options: [
      { label: "تحقيق نتائج ملموسة وإنجازات", value: "achievement" },
      { label: "فهم كيف يعمل العالم من حولي", value: "curiosity" },
      { label: "التنافس والتحدي مع الآخرين", value: "competition" },
      { label: "التأثير الإيجابي في حياة الناس", value: "impact" },
    ],
  },
];

interface Props {
  profile: StudentProfile;
  onClose: () => void;
}

interface PastResult {
  id: string;
  analysis_text: string;
  answers: Record<number, string>;
  created_at: string;
}

export default function CareerAptitudeTest({ profile, onClose }: Props) {
  const { user } = useAuth();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastResults, setPastResults] = useState<PastResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const progress = result ? 100 : ((currentQ) / questions.length) * 100;
  const currentQuestion = questions[currentQ];
  const allAnswered = Object.keys(answers).length === questions.length;

  const loadPastResults = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("aptitude_results")
      .select("id, analysis_text, answers, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPastResults((data as unknown as PastResult[]) || []);
    setLoadingHistory(false);
  }, [user]);

  const saveResult = useCallback(async () => {
    if (!user || !result) return;
    setSaving(true);
    const { error } = await supabase.from("aptitude_results").insert({
      user_id: user.id,
      answers: answers as any,
      analysis_text: result,
      student_profile: profile as any,
    });
    setSaving(false);
    if (error) {
      toast.error("فشل حفظ النتائج");
    } else {
      setSaved(true);
      toast.success("تم حفظ النتائج بنجاح! ✅");
    }
  }, [user, result, answers, profile]);

  const deleteResult = async (id: string) => {
    await supabase.from("aptitude_results").delete().eq("id", id);
    setPastResults(prev => prev.filter(r => r.id !== id));
    toast.success("تم حذف النتيجة");
  };

  const viewPastResult = (r: PastResult) => {
    setResult(r.analysis_text);
    setAnswers(r.answers);
    setSaved(true);
    setShowHistory(false);
  };

  const selectAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    }
  };

  const analyzeWithAI = useCallback(async () => {
    setLoading(true);
    const summary = questions.map(q => {
      const chosen = q.options.find(o => o.value === answers[q.id]);
      return `${q.text} → ${chosen?.label}`;
    }).join("\n");

    const prompt = `أنا ${profile.name}، ${profile.gender === "male" ? "ولد" : "بنت"}، من ${profile.country}، مستوى ${profile.level}.

أجبت على اختبار الميول المهني كالتالي:
${summary}

بناءً على إجاباتي، حلل شخصيتي واقترح لي أفضل 5 مهن مناسبة لي مع شرح لماذا تناسبني كل مهنة. اكتب التحليل بأسلوب ودّي ومشجع مناسب لعمري. أضف نصائح عملية لكل مهنة. استخدم إيموجي مناسبة.`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          studentProfile: profile,
        }),
      });

      if (!resp.ok) throw new Error(`خطأ (${resp.status})`);
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setResult(fullText);
            }
          } catch { /* partial */ }
        }
      }

      if (!fullText) setResult("لم نتمكن من تحليل النتائج. حاول مرة أخرى.");
    } catch (e: any) {
      setResult(`⚠️ ${e.message || "حدث خطأ"}`);
    } finally {
      setLoading(false);
    }
  }, [answers, profile]);

  const restart = () => {
    setCurrentQ(0);
    setAnswers({});
    setResult(null);
    setSaved(false);
  };

  return (
    <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-black">اختبار الميول المهني</h2>
              <p className="text-sm opacity-80">
                {result ? "نتائج التحليل" : `السؤال ${currentQ + 1} من ${questions.length}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
            ✕
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 gap-1"
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadPastResults(); }}
            >
              <History className="w-4 h-4" /> السجل
            </Button>
          )}
        </div>
        <Progress value={progress} className="mt-4 h-2 bg-primary-foreground/20" />
      </div>

      <div className="p-6 md:p-8">
        {/* Past Results History */}
        {showHistory && (
          <div className="space-y-4 animate-in fade-in">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> نتائجك السابقة
            </h3>
            {loadingHistory ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : pastResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">لا توجد نتائج محفوظة بعد</p>
            ) : (
              pastResults.map(r => (
                <div key={r.id} className="p-4 rounded-2xl border border-border bg-muted/30 flex justify-between items-center gap-3">
                  <button className="flex-1 text-right" onClick={() => viewPastResult(r)}>
                    <p className="font-medium text-foreground text-sm truncate">{r.analysis_text.slice(0, 80)}...</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString("ar")}</p>
                  </button>
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={() => deleteResult(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowHistory(false)}>
              إغلاق السجل
            </Button>
          </div>
        )}
        {!showHistory && !result && !loading && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-primary mt-1 shrink-0" />
              <h3 className="text-xl font-bold text-foreground">{currentQuestion.text}</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((opt) => {
                const selected = answers[currentQuestion.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => selectAnswer(opt.value)}
                    className={`p-5 rounded-2xl text-right border-2 flex justify-between items-center transition-all text-base font-medium ${
                      selected
                        ? "border-primary bg-primary/10 text-primary scale-[1.01]"
                        : "border-border hover:border-primary/40 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(currentQ - 1)}
                className="rounded-xl gap-1"
              >
                <ArrowRight className="w-4 h-4" /> السابق
              </Button>

              <div className="flex gap-1.5">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      i === currentQ ? "bg-primary scale-125" : answers[questions[i].id] ? "bg-primary/40" : "bg-border"
                    }`}
                    onClick={() => setCurrentQ(i)}
                  />
                ))}
              </div>

              {currentQ < questions.length - 1 ? (
                <Button
                  size="sm"
                  disabled={!answers[currentQuestion.id]}
                  onClick={() => setCurrentQ(currentQ + 1)}
                  className="rounded-xl gap-1"
                >
                  التالي <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!allAnswered}
                  onClick={analyzeWithAI}
                  className="rounded-xl gap-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  <Sparkles className="w-4 h-4" /> تحليل النتائج
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-16 animate-in fade-in">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-bold text-foreground">منير عم يحلل شخصيتك...</p>
            <p className="text-sm text-muted-foreground">هالشي بياخد كم ثانية ⏳</p>
          </div>
        )}

        {/* Results */}
        {!showHistory && result && !loading && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground [&>*:first-child]:mt-0">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="rounded-xl gap-2" onClick={restart}>
                <RotateCcw className="w-4 h-4" /> إعادة الاختبار
              </Button>
              {user && !saved && (
                <Button
                  className="rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={saveResult}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ النتائج
                </Button>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium px-3">
                  <CheckCircle2 className="w-4 h-4" /> تم الحفظ
                </span>
              )}
              <Button variant="outline" className="rounded-xl gap-2" onClick={onClose}>
                العودة للوحة التحكم
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
