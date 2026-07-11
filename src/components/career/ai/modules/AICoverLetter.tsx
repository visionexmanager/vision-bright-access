import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";
import type { CoverLetterTone } from "../types";

const TONES: { id: CoverLetterTone; labelKey: string }[] = [
  { id: "formal", labelKey: "aiSuite.coverLetter.tone.formal" },
  { id: "casual", labelKey: "aiSuite.coverLetter.tone.casual" },
  { id: "persuasive", labelKey: "aiSuite.coverLetter.tone.persuasive" },
];

const TONE_OPENER: Record<CoverLetterTone, string> = {
  formal: "I am writing to express my interest in",
  casual: "I'm excited to apply for",
  persuasive: "I'm confident I'm exactly who you need for",
};

function buildCoverLetter(job: string, company: string, tone: CoverLetterTone): string {
  const p = MOCK_PROFILE;
  const topSkills = p.skills.slice(0, 3).map((s) => s.name).join(", ");
  return [
    `Dear ${company || "Hiring"} Team,`,
    "",
    `${TONE_OPENER[tone]} the ${job || "role"} position${company ? ` at ${company}` : ""}. ${p.bio}`,
    "",
    `In my current role as ${p.experience[0]?.title ?? "a professional"} at ${p.experience[0]?.company ?? "my current company"}, I've built strong expertise in ${topSkills}, and I'm eager to bring that experience to your team.`,
    "",
    `I'd welcome the chance to discuss how I can contribute. Thank you for your time and consideration.`,
    "",
    `Sincerely,`,
    p.fullName,
  ].join("\n");
}

export function AICoverLetter() {
  const { t } = useLanguage();
  const [job, setJob] = useState("");
  const [company, setCompany] = useState("");
  const [tone, setTone] = useState<CoverLetterTone>("formal");
  const [copied, setCopied] = useState(false);
  const { loading, result, run } = useAiSimulation(() => buildCoverLetter(job, company, tone), 1500);

  const copy = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.coverLetter.desc")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cl-job" className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.coverLetter.jobLabel")}</Label>
          <Input id="cl-job" value={job} onChange={(e) => setJob(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cl-company" className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.coverLetter.companyLabel")}</Label>
          <Input id="cl-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.coverLetter.toneLabel")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((tn) => (
            <button
              key={tn.id}
              type="button"
              onClick={() => setTone(tn.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                tone === tn.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {t(tn.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={run} disabled={loading} className="self-start">{t("aiSuite.coverLetter.generate")}</Button>

      {loading && <AIThinkingIndicator label={t("aiSuite.coverLetter.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-2">
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed">{result}</pre>
          <Button variant="outline" size="sm" onClick={copy} className="self-start">
            {copied ? <Check className="me-1.5 h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {t(copied ? "aiSuite.coverLetter.copied" : "aiSuite.coverLetter.copy")}
          </Button>
        </div>
      )}
    </div>
  );
}
