import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Sparkles, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { SKILL_DEMAND, SKILL_GAPS, RECOMMENDED_SKILLS } from "./mock/mockSkills";

const axisTick = { fontSize: 11, fill: "hsl(var(--intel-muted))" };
const tooltipStyle = { contentStyle: { background: "hsl(var(--intel-bg-elevated))", border: "1px solid hsl(var(--intel-border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--intel-foreground))" } };

export function SkillDemandEngine() {
  const { t } = useLanguage();
  const gapData = SKILL_GAPS.map((g) => ({ label: g.skill, demand: g.demand, supply: g.supply }));

  return (
    <IntelSection id="skills" title={t("intel.skills.title")} subtitle={t("intel.skills.subtitle")}>
      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-3 text-sm font-bold">{t("intel.skills.topWorldwide")}</p>
        <div className="flex flex-col gap-3">
          {SKILL_DEMAND.map((s) => (
            <div key={s.skill}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{s.skill}</span>
                <span className="text-xs">
                  <span className="font-bold text-primary">{s.demandScore}</span>
                  <span className="intel-muted"> · +{s.growthPercent}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--intel-neon))]" style={{ width: `${s.demandScore}%` }} />
              </div>
              <p className="intel-muted mt-1 text-[11px]">{t("intel.skills.byCountry")}: {s.topCountries.join(", ")} · {t("intel.skills.byIndustry")}: {s.topIndustries.join(", ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-3 text-sm font-bold">{t("intel.skills.gapAnalysis")}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gapData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--intel-border))" />
            <XAxis dataKey="label" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={axisTick} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="demand" name={t("intel.skills.demand")} fill="#22d3ee" radius={[4, 4, 0, 0]} />
            <Bar dataKey="supply" name={t("intel.skills.supply")} fill="#64748b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="intel-panel rounded-2xl border-primary/30 p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />{t("intel.skills.recommended")}</p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED_SKILLS.map((s) => (
            <span key={s} className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </IntelSection>
  );
}
