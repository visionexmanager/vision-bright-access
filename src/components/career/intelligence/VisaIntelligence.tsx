import { Plane } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IntelSection } from "./IntelSection";
import { VISA_INTEL } from "./mock/mockVisa";

export function VisaIntelligence() {
  const { t } = useLanguage();

  return (
    <IntelSection id="visa" title={t("intel.visa.title")} subtitle={t("intel.visa.subtitle")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VISA_INTEL.map((v) => (
          <div key={v.country} className="intel-panel flex flex-col gap-3 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="font-bold">{v.country}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div><p className="intel-muted">{t("intel.visa.ease")}</p><p className="font-bold text-primary">{v.visaEaseScore}</p></div>
              <div><p className="intel-muted">{t("intel.visa.sponsorship")}</p><p className="font-bold text-primary">{v.sponsorshipIndex}</p></div>
              <div><p className="intel-muted">{t("intel.visa.difficulty")}</p><p className="font-bold text-amber-400">{v.relocationDifficulty}</p></div>
            </div>
            <div>
              <p className="intel-muted mb-1 text-[11px]">{t("intel.visa.friendlyJobs")}</p>
              <div className="flex flex-wrap gap-1.5">
                {v.migrationFriendlyJobs.map((j) => <span key={j} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px]">{j}</span>)}
              </div>
            </div>
            <div>
              <p className="intel-muted mb-1 text-[11px]">{t("intel.visa.paths")}</p>
              <ul className="text-xs">
                {v.immigrationPaths.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </IntelSection>
  );
}
