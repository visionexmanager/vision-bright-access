import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { IntelSection } from "./IntelSection";
import { detectFakeJob } from "./fakeJobDetectorLogic";

const SAMPLE_LEGIT = "Senior Backend Engineer at Nova Systems. We're looking for an experienced Node.js developer to join our platform team. Competitive salary, remote-friendly, standard interview process with our engineering team.";
const SAMPLE_SCAM = "URGENT HIRING! No interview needed, start today! Earn unlimited income working just 2 hours a day. Send a small processing fee via wire transfer to secure your position with our confidential company.";

export function FakeJobDetector() {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const { loading, result, run, reset } = useAiSimulation(() => detectFakeJob(text), 1400);

  const analyze = () => {
    if (!text.trim()) return;
    run();
  };

  const riskLevel = result ? (result.riskScore >= 65 ? "high" : result.riskScore >= 35 ? "medium" : "low") : null;
  const riskColor = riskLevel === "high" ? "hsl(var(--intel-negative))" : riskLevel === "medium" ? "#fbbf24" : "hsl(var(--intel-positive))";

  return (
    <IntelSection id="fakejobs" title={t("intel.fakeJobs.title")} subtitle={t("intel.fakeJobs.subtitle")}>
      <div className="intel-panel rounded-2xl p-5">
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); reset(); }}
          rows={5}
          placeholder={t("intel.fakeJobs.placeholder")}
          className="resize-none bg-transparent"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={analyze} disabled={!text.trim() || loading}>{t("intel.fakeJobs.analyze")}</Button>
          <button type="button" onClick={() => { setText(SAMPLE_LEGIT); reset(); }} className="rounded-full border intel-border px-3 py-1.5 text-xs intel-muted hover:text-primary">{t("intel.fakeJobs.sampleLegit")}</button>
          <button type="button" onClick={() => { setText(SAMPLE_SCAM); reset(); }} className="rounded-full border intel-border px-3 py-1.5 text-xs intel-muted hover:text-primary">{t("intel.fakeJobs.sampleScam")}</button>
        </div>
      </div>

      {loading && <AIThinkingIndicator label={t("intel.fakeJobs.thinking")} />}

      {result && !loading && (
        <div className="intel-panel flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {riskLevel === "low" ? <ShieldCheck className="h-8 w-8" style={{ color: riskColor }} aria-hidden="true" /> : <ShieldAlert className="h-8 w-8" style={{ color: riskColor }} aria-hidden="true" />}
            <div>
              <p className="text-2xl font-black" style={{ color: riskColor }}>{result.riskScore}/100</p>
              <p className="intel-muted text-xs">{t("intel.fakeJobs.riskScore")} · {t("intel.fakeJobs.confidence")}: {result.confidence}%</p>
            </div>
          </div>
          <p className="text-sm">{result.explanation}</p>
          {result.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.flags.map((f) => (
                <span key={f} className="rounded-full bg-[hsl(var(--intel-negative)/0.15)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--intel-negative))]">
                  {t(`intel.fakeJobs.flag.${f}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </IntelSection>
  );
}
