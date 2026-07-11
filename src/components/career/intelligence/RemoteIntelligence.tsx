import { Globe, Clock, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { IntelSection } from "./IntelSection";
import { REMOTE_COUNTRY_STATS, REMOTE_FRIENDLY_INDUSTRIES, REMOTE_EMPLOYERS } from "./mock/mockRemote";

export function RemoteIntelligence() {
  const { t } = useLanguage();

  return (
    <IntelSection id="remote" title={t("intel.remote.title")} subtitle={t("intel.remote.subtitle")}>
      <div className="intel-panel rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Globe className="h-4 w-4 text-primary" aria-hidden="true" />{t("intel.remote.bestCountries")}</p>
        <div className="flex flex-col gap-2.5">
          {REMOTE_COUNTRY_STATS.map((c) => (
            <div key={c.country} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border intel-border px-3 py-2.5 text-sm">
              <span className="font-medium">{c.country}</span>
              <span className="intel-muted flex items-center gap-1 text-xs"><Clock className="h-3 w-3" aria-hidden="true" />{c.timezoneGroup}</span>
              <span className="text-xs">${c.avgRemoteSalaryUsd.toLocaleString()}</span>
              <span className="text-xs font-semibold text-[hsl(var(--intel-positive))]">+{c.growthPercent}%</span>
              <span className="font-bold text-primary">{c.remoteScore}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 text-sm font-bold">{t("intel.remote.friendlyIndustries")}</p>
          <div className="flex flex-wrap gap-2">
            {REMOTE_FRIENDLY_INDUSTRIES.map((ind) => (
              <span key={ind} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">{ind}</span>
            ))}
          </div>
        </div>

        <div className="intel-panel rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />{t("intel.remote.topEmployers")}</p>
          <ul className="flex flex-col gap-2">
            {REMOTE_EMPLOYERS.map((e) => (
              <li key={e.name} className="flex items-center gap-3 text-sm">
                <CompanyAvatar name={e.name} color={e.color} size="sm" />
                <span className="flex-1 font-medium">{e.name}</span>
                <span className="intel-muted text-xs">{e.industry}</span>
                <span className="font-bold text-primary">{e.remoteJobs}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </IntelSection>
  );
}
