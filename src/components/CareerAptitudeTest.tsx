import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  BrainCircuit, ArrowRight, ArrowLeft, Loader2, RotateCcw,
  Sparkles, CheckCircle2, Target, History, Trash2, Save, Clock,
  Share2, Copy, Twitter, Facebook, Link2
} from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-chat`;

interface StudentProfile {
  name: string;
  gender: "male" | "female";
  country: string;
  level: string;
}

interface QuestionDef {
  id: number;
  category: string;
  textKey: string;
  options: { labelKey: string; value: string }[];
}

const questionDefs: QuestionDef[] = [
  {
    id: 1, category: "personality", textKey: "aptitude.q1",
    options: [
      { labelKey: "aptitude.q1.a", value: "analytical" },
      { labelKey: "aptitude.q1.b", value: "creative" },
      { labelKey: "aptitude.q1.c", value: "physical" },
      { labelKey: "aptitude.q1.d", value: "social" },
    ],
  },
  {
    id: 2, category: "skills", textKey: "aptitude.q2",
    options: [
      { labelKey: "aptitude.q2.a", value: "stem" },
      { labelKey: "aptitude.q2.b", value: "humanities" },
      { labelKey: "aptitude.q2.c", value: "arts" },
      { labelKey: "aptitude.q2.d", value: "business" },
    ],
  },
  {
    id: 3, category: "workstyle", textKey: "aptitude.q3",
    options: [
      { labelKey: "aptitude.q3.a", value: "independent" },
      { labelKey: "aptitude.q3.b", value: "team" },
      { labelKey: "aptitude.q3.c", value: "leader" },
      { labelKey: "aptitude.q3.d", value: "hands-on" },
    ],
  },
  {
    id: 4, category: "values", textKey: "aptitude.q4",
    options: [
      { labelKey: "aptitude.q4.a", value: "financial" },
      { labelKey: "aptitude.q4.b", value: "service" },
      { labelKey: "aptitude.q4.c", value: "innovation" },
      { labelKey: "aptitude.q4.d", value: "freedom" },
    ],
  },
  {
    id: 5, category: "interests", textKey: "aptitude.q5",
    options: [
      { labelKey: "aptitude.q5.a", value: "tech" },
      { labelKey: "aptitude.q5.b", value: "design" },
      { labelKey: "aptitude.q5.c", value: "research" },
      { labelKey: "aptitude.q5.d", value: "management" },
    ],
  },
  {
    id: 6, category: "problemSolving", textKey: "aptitude.q6",
    options: [
      { labelKey: "aptitude.q6.a", value: "logical" },
      { labelKey: "aptitude.q6.b", value: "creative" },
      { labelKey: "aptitude.q6.c", value: "collaborative" },
      { labelKey: "aptitude.q6.d", value: "practical" },
    ],
  },
  {
    id: 7, category: "environment", textKey: "aptitude.q7",
    options: [
      { labelKey: "aptitude.q7.a", value: "office" },
      { labelKey: "aptitude.q7.b", value: "medical" },
      { labelKey: "aptitude.q7.c", value: "studio" },
      { labelKey: "aptitude.q7.d", value: "outdoor" },
    ],
  },
  {
    id: 8, category: "motivation", textKey: "aptitude.q8",
    options: [
      { labelKey: "aptitude.q8.a", value: "achievement" },
      { labelKey: "aptitude.q8.b", value: "curiosity" },
      { labelKey: "aptitude.q8.c", value: "competition" },
      { labelKey: "aptitude.q8.d", value: "impact" },
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
  const { t, lang } = useLanguage();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastResults, setPastResults] = useState<PastResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const progress = result ? 100 : ((currentQ) / questionDefs.length) * 100;
  const currentQuestion = questionDefs[currentQ];
  const allAnswered = Object.keys(answers).length === questionDefs.length;

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
      toast.error(t("aptitude.saveFailed"));
    } else {
      setSaved(true);
      toast.success(t("aptitude.saveSuccess"));
    }
  }, [user, result, answers, profile, t]);

  const deleteResult = async (id: string) => {
    await supabase.from("aptitude_results").delete().eq("id", id);
    setPastResults(prev => prev.filter(r => r.id !== id));
    toast.success(t("aptitude.deleted"));
  };

  const viewPastResult = (r: PastResult) => {
    setResult(r.analysis_text);
    setAnswers(r.answers);
    setSaved(true);
    setShowHistory(false);
  };

  const getShareText = () => {
    if (!result) return "";
    const firstLine = result.split("\n").find(l => l.trim()) || "";
    const url = `${window.location.origin}/academy`;
    return t("aptitude.shareText")
      .replace("{summary}", firstLine.slice(0, 100))
      .replace("{url}", url);
  };

  const copyResultAsText = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      toast.success(t("aptitude.copied"));
    } catch {
      toast.error(t("aptitude.copyFailed"));
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(`${window.location.origin}/academy`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/academy`);
      toast.success(t("aptitude.linkCopied"));
    } catch {
      toast.error(t("aptitude.copyFailed"));
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("aptitude.shareTitle"),
          text: getShareText(),
          url: `${window.location.origin}/academy`,
        });
      } catch { /* user cancelled */ }
    } else {
      setShowShareMenu(true);
    }
  };

  const selectAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    if (currentQ < questionDefs.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    }
  };

  const analyzeWithAI = useCallback(async () => {
    setLoading(true);
    const summary = questionDefs.map(q => {
      const chosen = q.options.find(o => o.value === answers[q.id]);
      return `${t(q.textKey)} → ${chosen ? t(chosen.labelKey) : ""}`;
    }).join("\n");

    const prompt = `أنا ${profile.name}، ${profile.gender === "male" ? "ولد" : "بنت"}، من ${profile.country}، مستوى ${profile.level}.

أجبت على اختبار الميول المهني كالتالي:
${summary}

بناءً على إجاباتي، حلل شخصيتي واقترح لي أفضل 5 مهن مناسبة لي مع شرح لماذا تناسبني كل مهنة. اكتب التحليل بأسلوب ودّي ومشجع مناسب لعمري. أضف نصائح عملية لكل مهنة. استخدم إيموجي مناسبة.${lang !== "ar" ? `\n\nPlease respond in the language with code "${lang}".` : ""}`;

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          studentProfile: profile,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                setResult(fullText);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setResult(null);
      toast.error(t("aptitude.saveFailed"));
    } finally {
      setLoading(false);
    }
  }, [answers, profile, t, lang]);

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
              <h2 className="text-xl font-black">{t("aptitude.title")}</h2>
              <p className="text-sm opacity-80">
                {result ? t("aptitude.results") : t("aptitude.questionOf").replace("{current}", String(currentQ + 1)).replace("{total}", String(questionDefs.length))}
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
              <History className="w-4 h-4" /> {t("aptitude.history")}
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
              <Clock className="w-5 h-5 text-primary" /> {t("aptitude.pastResults")}
            </h3>
            {loadingHistory ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : pastResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("aptitude.noPastResults")}</p>
            ) : (
              pastResults.map(r => (
                <div key={r.id} className="p-4 rounded-2xl border border-border bg-muted/30 flex justify-between items-center gap-3">
                  <button className="flex-1 text-right" onClick={() => viewPastResult(r)}>
                    <p className="font-medium text-foreground text-sm truncate">{r.analysis_text.slice(0, 80)}...</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString(lang)}</p>
                  </button>
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={() => deleteResult(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowHistory(false)}>
              {t("aptitude.closeHistory")}
            </Button>
          </div>
        )}
        {!showHistory && !result && !loading && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-primary mt-1 shrink-0" />
              <h3 className="text-xl font-bold text-foreground">{t(currentQuestion.textKey)}</h3>
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
                    <span>{t(opt.labelKey)}</span>
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
                <ArrowRight className="w-4 h-4" /> {t("aptitude.prev")}
              </Button>

              <div className="flex gap-1.5">
                {questionDefs.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      i === currentQ ? "bg-primary scale-125" : answers[questionDefs[i].id] ? "bg-primary/40" : "bg-border"
                    }`}
                    onClick={() => setCurrentQ(i)}
                  />
                ))}
              </div>

              {currentQ < questionDefs.length - 1 ? (
                <Button
                  size="sm"
                  disabled={!answers[currentQuestion.id]}
                  onClick={() => setCurrentQ(currentQ + 1)}
                  className="rounded-xl gap-1"
                >
                  {t("aptitude.next")} <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!allAnswered}
                  onClick={analyzeWithAI}
                  className="rounded-xl gap-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  <Sparkles className="w-4 h-4" /> {t("aptitude.analyze")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-16 animate-in fade-in">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-bold text-foreground">{t("aptitude.analyzing")}</p>
            <p className="text-sm text-muted-foreground">{t("aptitude.analyzingWait")}</p>
          </div>
        )}

        {/* Results */}
        {!showHistory && result && !loading && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground [&>*:first-child]:mt-0">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>

            {/* Share Section */}
            <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> {t("aptitude.shareResults")}
                </span>
                <Button variant="ghost" size="sm" className="rounded-xl gap-1" onClick={nativeShare}>
                  <Share2 className="w-4 h-4" /> {t("aptitude.share")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={shareToTwitter}>
                  <Twitter className="w-3.5 h-3.5" /> {t("aptitude.twitter")}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={shareToFacebook}>
                  <Facebook className="w-3.5 h-3.5" /> {t("aptitude.facebook")}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={shareToWhatsApp}>
                  💬 {t("aptitude.whatsapp")}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={copyResultAsText}>
                  <Copy className="w-3.5 h-3.5" /> {t("aptitude.copyText")}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={copyLink}>
                  <Link2 className="w-3.5 h-3.5" /> {t("aptitude.copyLink")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="rounded-xl gap-2" onClick={restart}>
                <RotateCcw className="w-4 h-4" /> {t("aptitude.restart")}
              </Button>
              {user && !saved && (
                <Button
                  className="rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={saveResult}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("aptitude.save")}
                </Button>
              )}
              {saved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium px-3">
                  <CheckCircle2 className="w-4 h-4" /> {t("aptitude.saved")}
                </span>
              )}
              <Button variant="outline" className="rounded-xl gap-2" onClick={onClose}>
                {t("aptitude.backToDashboard")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
