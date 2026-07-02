import { useState } from "react";
import { Send, CheckCircle2, FileText, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";

interface RequirementsAnalysis {
  matched: string[];
  missing: string[];
}

function analyzeRequirements(): RequirementsAnalysis {
  const profileSkills = new Set(MOCK_PROFILE.skills.map((s) => s.name.toLowerCase()));
  const jobSkills = ["React", "TypeScript", "Accessibility", "GraphQL"];
  return {
    matched: jobSkills.filter((s) => profileSkills.has(s.toLowerCase())),
    missing: jobSkills.filter((s) => !profileSkills.has(s.toLowerCase())),
  };
}

function tailorResumeSummary(role: string, company: string): string {
  const top = MOCK_PROFILE.skills.slice(0, 3).map((s) => s.name).join(", ");
  return `${MOCK_PROFILE.fullName} is a ${MOCK_PROFILE.headline} with strong expertise in ${top}, well-suited for the ${role || "role"} position${company ? ` at ${company}` : ""}.`;
}

function tailorCoverLetter(role: string, company: string): string {
  return `Dear ${company || "Hiring"} Team,\n\nI'm excited to apply for the ${role || "open"} position${company ? ` at ${company}` : ""}. ${MOCK_PROFILE.bio}\n\nI'd welcome the chance to discuss how I can contribute.\n\nSincerely,\n${MOCK_PROFILE.fullName}`;
}

export function ApplicationAssistant() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const analysis = useAiSimulation(analyzeRequirements, 1300);
  const resume = useAiSimulation(() => tailorResumeSummary(role, company), 1300);
  const coverLetter = useAiSimulation(() => tailorCoverLetter(role, company), 1300);

  const confirmApplication = () => {
    playSound("success");
    toast.success(t("agentUI.application.confirmedToast"));
    setReviewOpen(false);
  };

  const canReview = Boolean(analysis.result && resume.result && coverLetter.result);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.application")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.application.subtitle")}</p>
      </div>

      <div className="agent-glass grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="app-role" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.application.roleLabel")}</Label>
          <Input id="app-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Frontend Engineer" />
        </div>
        <div>
          <Label htmlFor="app-company" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.application.companyLabel")}</Label>
          <Input id="app-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nova Systems" />
        </div>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.application.step1")}</p>
        {!analysis.result && !analysis.loading && <Button size="sm" onClick={analysis.run} disabled={!role}>{t("agentUI.application.analyze")}</Button>}
        {analysis.loading && <AIThinkingIndicator label={t("agentUI.application.analyzing")} />}
        {analysis.result && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.result.matched.map((s) => <span key={s} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{s}</span>)}
            {analysis.result.missing.map((s) => <span key={s} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">{s}</span>)}
          </div>
        )}
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.application.step2")}</p>
        {!resume.result && !resume.loading && <Button size="sm" onClick={resume.run} disabled={!analysis.result}>{t("agentUI.application.tailorResume")}</Button>}
        {resume.loading && <AIThinkingIndicator label={t("agentUI.application.tailoring")} />}
        {resume.result && <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{resume.result}</p>}
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Mail className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.application.step3")}</p>
        {!coverLetter.result && !coverLetter.loading && <Button size="sm" onClick={coverLetter.run} disabled={!resume.result}>{t("agentUI.application.tailorCoverLetter")}</Button>}
        {coverLetter.loading && <AIThinkingIndicator label={t("agentUI.application.tailoring")} />}
        {coverLetter.result && <pre className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{coverLetter.result}</pre>}
      </div>

      <Button size="lg" onClick={() => setReviewOpen(true)} disabled={!canReview} className="self-start">
        <Send className="me-2 h-4 w-4" aria-hidden="true" />
        {t("agentUI.application.reviewConfirm")}
      </Button>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("agentUI.application.reviewTitle")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p><span className="font-semibold">{t("agentUI.application.roleLabel")}:</span> {role}</p>
            <p><span className="font-semibold">{t("agentUI.application.companyLabel")}:</span> {company}</p>
            <p className="text-muted-foreground">{resume.result}</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{coverLetter.result}</pre>
            <p className="flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("agentUI.application.noAutoSend")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={confirmApplication}>{t("agentUI.application.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
