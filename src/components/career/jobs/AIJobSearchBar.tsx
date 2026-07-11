import { useState } from "react";
import { Sparkles, Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, fadeUp } from "@/components/AnimatedSection";
import { parseJobQuery } from "./aiParser";
import type { ParsedAiQuery } from "./types";

interface AIJobSearchBarProps {
  onApply: (parsed: ParsedAiQuery) => void;
}

const EXAMPLE_KEYS = ["careersPage.aiSearch.example1", "careersPage.aiSearch.example2", "careersPage.aiSearch.example3"];

export function AIJobSearchBar({ onApply }: AIJobSearchBarProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedAiQuery | null>(null);

  const handleAnalyze = () => {
    if (!text.trim()) return;
    playSound("scan");
    const result = parseJobQuery(text);
    setParsed(result);
    onApply(result);
  };

  return (
    <AnimatedSection variants={fadeUp} className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold">{t("careersPage.aiSearch.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("careersPage.aiSearch.disclaimer")}</p>
          </div>
        </div>

        <label htmlFor="ai-job-search" className="sr-only">{t("careersPage.aiSearch.title")}</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Textarea
            id="ai-job-search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAnalyze(); }
            }}
            placeholder={t("careersPage.aiSearch.placeholder")}
            rows={2}
            className="resize-none bg-background"
          />
          <Button onClick={handleAnalyze} disabled={!text.trim()} className="sm:h-auto sm:px-6">
            <Send className="me-2 h-4 w-4" aria-hidden="true" />
            {t("careersPage.aiSearch.analyze")}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setText(t(key))}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t(key)}
            </button>
          ))}
        </div>

        {parsed && (
          <div role="status" aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-card p-3 text-sm">
            <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p>
              <span className="font-semibold">{t("careersPage.aiSearch.understood")}: </span>
              {parsed.summary}
            </p>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
