import { useState } from "react";
import { Download, Printer, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MOCK_PROFILE } from "@/components/career/dashboard/mock/mockProfile";
import { useAiSimulation } from "../useAiSimulation";
import { AIThinkingIndicator } from "../AIThinkingIndicator";

const TEMPLATES = [
  { id: "modern", labelKey: "aiSuite.resumeBuilder.template.modern" },
  { id: "classic", labelKey: "aiSuite.resumeBuilder.template.classic" },
  { id: "minimal", labelKey: "aiSuite.resumeBuilder.template.minimal" },
  { id: "creative", labelKey: "aiSuite.resumeBuilder.template.creative" },
];

function buildResumeText(role: string, template: string): string {
  const p = MOCK_PROFILE;
  const topSkills = p.skills.slice(0, 6).map((s) => s.name).join(", ");
  const lines = [
    `${p.fullName} — ${role || p.headline}`,
    `${p.location} · ${p.links.linkedin} · ${p.links.github}`,
    "",
    `SUMMARY`,
    `${p.bio} Proven track record targeting ${role || p.headline} roles, with hands-on strength in ${topSkills}.`,
    "",
    `SKILLS`,
    topSkills,
    "",
    `EXPERIENCE`,
    ...p.experience.flatMap((e) => [
      `${e.title} — ${e.company} (${e.startDate} – ${e.endDate ?? "Present"})`,
      `• ${e.description}`,
    ]),
    "",
    `EDUCATION`,
    ...p.education.map((e) => `${e.degree}, ${e.institution} (${e.startYear}–${e.endYear ?? "Present"})`),
    "",
    `[Template: ${template}]`,
  ];
  return lines.join("\n");
}

export function AIResumeBuilder() {
  const { t } = useLanguage();
  const [role, setRole] = useState("");
  const [template, setTemplate] = useState("modern");
  const { loading, result, run } = useAiSimulation(() => buildResumeText(role, template), 1600);

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const ATS_CHECKS = [
    "aiSuite.resumeBuilder.check.keywords",
    "aiSuite.resumeBuilder.check.actionVerbs",
    "aiSuite.resumeBuilder.check.sections",
    "aiSuite.resumeBuilder.check.length",
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("aiSuite.resumeBuilder.desc")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rb-role" className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.resumeBuilder.roleLabel")}</Label>
          <Input id="rb-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("aiSuite.resumeBuilder.rolePlaceholder")} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">{t("aiSuite.resumeBuilder.templateLabel")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplate(tpl.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  template === tpl.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t(tpl.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={run} disabled={loading} className="self-start">{t("aiSuite.resumeBuilder.generate")}</Button>

      {loading && <AIThinkingIndicator label={t("aiSuite.resumeBuilder.thinking")} />}

      {result && !loading && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {ATS_CHECKS.map((key) => (
              <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                {t(key)}
              </div>
            ))}
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed">{result}</pre>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTxt}>
              <Download className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("aiSuite.resumeBuilder.downloadTxt")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("aiSuite.resumeBuilder.printPdf")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
