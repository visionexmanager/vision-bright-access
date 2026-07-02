import { Briefcase, TrendingUp, Globe, MapPin, Sparkles, DollarSign, Bot, HeartPulse } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { IntelStatCard } from "./IntelStatCard";
import { GLOBAL_METRICS } from "./mock/mockOverview";
import { COUNTRY_JOB_DATA } from "./mock/mockCountries";
import { SKILL_DEMAND } from "./mock/mockSkills";

const ICONS: Record<string, typeof Briefcase> = {
  jobsIndex: Briefcase,
  demandGrowth: TrendingUp,
  remoteRatio: Globe,
  topHiringCountries: MapPin,
  fastestSkills: Sparkles,
  salaryInflation: DollarSign,
  aiImpact: Bot,
  marketHealth: HeartPulse,
};

export function GlobalOverview() {
  const { t } = useLanguage();
  const topCountries = [...COUNTRY_JOB_DATA].sort((a, b) => b.hiringIntensity - a.hiringIntensity).slice(0, 5);
  const topSkills = [...SKILL_DEMAND].sort((a, b) => b.growthPercent - a.growthPercent).slice(0, 5);

  return (
    <IntelSection id="overview" title={t("intel.overview.title")} subtitle={t("intel.overview.subtitle")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GLOBAL_METRICS.map((metric) => (
          <IntelStatCard key={metric.id} icon={ICONS[metric.id]} label={t(metric.labelKey)} value={metric.value} suffix={metric.suffix} trend={metric.trend} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 text-sm font-bold">{t("intel.overview.topHiringCountries")}</p>
          <ol className="flex flex-col gap-2">
            {topCountries.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span><span className="intel-muted me-2">{i + 1}.</span>{c.name}</span>
                <span className="font-semibold text-primary">{c.hiringIntensity}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 text-sm font-bold">{t("intel.overview.fastestSkills")}</p>
          <ol className="flex flex-col gap-2">
            {topSkills.map((s, i) => (
              <li key={s.skill} className="flex items-center justify-between text-sm">
                <span><span className="intel-muted me-2">{i + 1}.</span>{s.skill}</span>
                <span className="font-semibold text-[hsl(var(--intel-positive))]">+{s.growthPercent}%</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </IntelSection>
  );
}
