import { useState } from "react";
import { Sparkles, Send, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { generateJobFromPrompt } from "../jobPromptParser";
import type { JobPosting } from "../types";

const EXAMPLE_KEYS = ["employerDash.postJob.example1", "employerDash.postJob.example2", "employerDash.postJob.example3"];

export function JobBuilder() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<Partial<JobPosting> | null>(null);
  const { loading, result, run } = useAiSimulation(() => generateJobFromPrompt(prompt), 1500);

  const generate = () => {
    if (!prompt.trim()) return;
    run();
  };

  const publish = () => {
    playSound("success");
    toast.success(t("employerDash.postJob.published"));
  };

  const activeDraft = draft ?? result;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.postJob")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.postJob.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-bold">{t("employerDash.postJob.aiTitle")}</p>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t("employerDash.postJob.aiDisclaimer")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("employerDash.postJob.placeholder")}
            rows={2}
            className="resize-none bg-background"
          />
          <Button onClick={generate} disabled={!prompt.trim() || loading} className="shrink-0 sm:h-auto sm:px-6">
            <Send className="me-2 h-4 w-4" aria-hidden="true" />
            {t("employerDash.postJob.generate")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPrompt(t(key))}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {loading && <AIThinkingIndicator label={t("employerDash.postJob.thinking")} />}

      {activeDraft && !loading && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              {t("employerDash.postJob.optimizationScore")}: {activeDraft.optimizationScore}/100
            </p>
          </div>

          <div>
            <Label htmlFor="jb-title" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.title")}</Label>
            <Input id="jb-title" value={activeDraft.title ?? ""} onChange={(e) => setDraft({ ...activeDraft, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="jb-desc" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.description")}</Label>
            <Textarea id="jb-desc" rows={3} value={activeDraft.description ?? ""} onChange={(e) => setDraft({ ...activeDraft, description: e.target.value })} />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.requirements")}</Label>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {(activeDraft.requirements ?? []).map((r) => <li key={r}>• {r}</li>)}
            </ul>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.skills")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(activeDraft.skills ?? []).map((s) => <span key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{s}</span>)}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.salaryRange")}</Label>
              <p className="text-sm font-semibold">{activeDraft.currency} {activeDraft.salaryMin?.toLocaleString()} – {activeDraft.salaryMax?.toLocaleString()}</p>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.jobType")}</Label>
              <p className="text-sm font-semibold">{activeDraft.type}</p>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.postJob.workMode")}</Label>
              <p className="text-sm font-semibold capitalize">{activeDraft.workMode}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeDraft.visaSponsorship && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">{t("employerDash.postJob.visaTag")}</span>}
            {(activeDraft.accessibilityTags ?? []).map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{tag}</span>
            ))}
          </div>

          <Button onClick={publish} className="self-start">{t("employerDash.postJob.publish")}</Button>
        </div>
      )}
    </div>
  );
}
