import { useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import { ScoreRing } from "../ScoreRing";
import type { ResumeAnalysisResult } from "../types";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function analyzeResume(fileName: string): ResumeAnalysisResult {
  const seed = hashString(fileName || "resume");
  return {
    atsScore: 60 + (seed % 35),
    jobMatchPercent: 55 + (seed % 40),
    grammarIssues: ["Passive voice in 2 bullet points", "Inconsistent date formatting"],
    skillGaps: ["Cloud infrastructure (AWS/GCP)", "System design", "Automated testing"],
    suggestions: [
      "Quantify achievements with numbers (%, $, time saved).",
      "Move your most relevant experience to the top.",
      "Add a concise 2-line professional summary.",
    ],
  };
}

export function AIResumeAnalyzer() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { loading, result, run, reset } = useAiSimulation(() => analyzeResume(fileName ?? ""), 1800);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.resumeAnalyzer.desc")}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{fileName ?? t("aiSuite.resumeAnalyzer.uploadPrompt")}</span>
        <span className="text-xs text-muted-foreground">{t("aiSuite.resumeAnalyzer.uploadHint")}</span>
      </button>

      {fileName && !result && (
        <Button onClick={run} disabled={loading} className="self-start">{t("aiSuite.resumeAnalyzer.analyze")}</Button>
      )}

      {loading && <AIThinkingIndicator label={t("aiSuite.resumeAnalyzer.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-around gap-4 rounded-2xl border border-border/60 bg-muted/20 p-5">
            <ScoreRing value={result.atsScore} sublabel="ATS" label={t("aiSuite.resumeAnalyzer.atsScore")} />
            <ScoreRing value={result.jobMatchPercent} sublabel="%" label={t("aiSuite.resumeAnalyzer.jobMatch")} />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />{t("aiSuite.resumeAnalyzer.grammarTitle")}</p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {result.grammarIssues.map((g) => <li key={g}>• {g}</li>)}
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><FileText className="h-4 w-4 text-red-500" aria-hidden="true" />{t("aiSuite.resumeAnalyzer.gapsTitle")}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.skillGaps.map((s) => <span key={s} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">{s}</span>)}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />{t("aiSuite.resumeAnalyzer.suggestionsTitle")}</p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {result.suggestions.map((s) => <li key={s}>• {s}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
