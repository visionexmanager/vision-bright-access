import { useState } from "react";
import { Mic, Keyboard, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { InterviewFeedback, InterviewMode, InterviewQuestion } from "../types";

const MODES: { id: InterviewMode; labelKey: string }[] = [
  { id: "hr", labelKey: "aiSuite.interview.mode.hr" },
  { id: "technical", labelKey: "aiSuite.interview.mode.technical" },
  { id: "behavioral", labelKey: "aiSuite.interview.mode.behavioral" },
];

const QUESTION_BANK: Record<InterviewMode, string[]> = {
  hr: ["Tell me about yourself.", "Why do you want to work here?", "Where do you see yourself in five years?"],
  technical: ["Walk me through how you'd debug a slow web page.", "Explain a technical decision you're proud of.", "How do you approach code reviews?"],
  behavioral: ["Describe a time you handled conflict with a teammate.", "Tell me about a project that failed. What did you learn?", "How do you prioritize when everything feels urgent?"],
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function scoreAnswer(answer: string): InterviewFeedback {
  const seed = hashString(answer);
  const base = Math.min(95, 55 + Math.min(answer.trim().split(/\s+/).length, 40));
  return {
    confidence: Math.min(96, base + (seed % 10)),
    clarity: Math.min(96, base + ((seed >> 2) % 10)),
    accuracy: Math.min(96, base + ((seed >> 4) % 10)),
    communication: Math.min(96, base + ((seed >> 6) % 10)),
  };
}

export function AIInterviewSimulator() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<InterviewMode | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<InterviewFeedback[]>([]);
  const { loading, result, run, reset } = useAiSimulation(() => scoreAnswer(answer), 1300);

  const questions: InterviewQuestion[] = mode
    ? QUESTION_BANK[mode].map((text, i) => ({ id: `${mode}-${i}`, mode, text }))
    : [];
  const currentQuestion = questions[questionIndex];
  const isLast = questionIndex === questions.length - 1;

  const startMode = (m: InterviewMode) => {
    setMode(m);
    setQuestionIndex(0);
    setHistory([]);
    setAnswer("");
    reset();
  };

  const submitAnswer = () => {
    if (!answer.trim()) return;
    run();
  };

  const next = () => {
    if (result) setHistory((prev) => [...prev, result]);
    setAnswer("");
    reset();
    setQuestionIndex((i) => i + 1);
  };

  const restart = () => setMode(null);

  const averages = history.length
    ? {
        confidence: Math.round(history.reduce((s, h) => s + h.confidence, 0) / history.length),
        clarity: Math.round(history.reduce((s, h) => s + h.clarity, 0) / history.length),
        accuracy: Math.round(history.reduce((s, h) => s + h.accuracy, 0) / history.length),
        communication: Math.round(history.reduce((s, h) => s + h.communication, 0) / history.length),
      }
    : null;

  if (!mode) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("aiSuite.interview.desc")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => startMode(m.id)}
              className="rounded-xl border border-border/60 bg-card p-5 text-center font-semibold transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" aria-hidden="true" />
          {t("aiSuite.interview.voiceReady")}
        </p>
      </div>
    );
  }

  if (questionIndex >= questions.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-bold">{t("aiSuite.interview.complete")}</p>
        {averages && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["confidence", "clarity", "accuracy", "communication"] as const).map((key) => (
              <div key={key} className="rounded-xl border border-border/50 p-3 text-center">
                <p className="text-xl font-black text-primary">{averages[key]}</p>
                <p className="text-xs text-muted-foreground">{t(`aiSuite.interview.metric.${key}`)}</p>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={restart} className="self-start">
          <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("aiSuite.interview.restart")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t(MODES.find((m) => m.id === mode)!.labelKey)}</span>
        <span>{questionIndex + 1} / {questions.length}</span>
      </div>
      <Progress value={((questionIndex + 1) / questions.length) * 100} />

      <p className="text-base font-semibold">{currentQuestion.text}</p>

      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        placeholder={t("aiSuite.interview.answerPlaceholder")}
        disabled={Boolean(result)}
      />

      {!result && (
        <Button onClick={submitAnswer} disabled={loading || !answer.trim()} className="self-start">
          <Keyboard className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("aiSuite.interview.submitAnswer")}
        </Button>
      )}

      {loading && <AIThinkingIndicator label={t("aiSuite.interview.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["confidence", "clarity", "accuracy", "communication"] as const).map((key) => (
              <div key={key} className="rounded-xl border border-border/50 p-3 text-center">
                <p className="text-lg font-black text-primary">{result[key]}</p>
                <p className="text-xs text-muted-foreground">{t(`aiSuite.interview.metric.${key}`)}</p>
              </div>
            ))}
          </div>
          <Button onClick={next} className="self-start">{t(isLast ? "aiSuite.interview.finish" : "aiSuite.interview.nextQuestion")}</Button>
        </div>
      )}
    </div>
  );
}
