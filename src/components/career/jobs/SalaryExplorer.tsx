import { useState } from "react";
import { Coins, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { POPULAR_COUNTRIES } from "./mockLocations";
import { estimateSalary } from "./salaryEstimator";
import type { ExperienceLevel, SalaryResult } from "./types";

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; labelKey: string }[] = [
  { value: "entry", labelKey: "careersPage.filter.experience.entry" },
  { value: "mid", labelKey: "careersPage.filter.experience.mid" },
  { value: "senior", labelKey: "careersPage.filter.experience.senior" },
  { value: "lead", labelKey: "careersPage.filter.experience.lead" },
];

export function SalaryExplorer() {
  const { t } = useLanguage();
  const [job, setJob] = useState("");
  const [country, setCountry] = useState(POPULAR_COUNTRIES[0].name);
  const [city, setCity] = useState(POPULAR_COUNTRIES[0].cities[0]?.name ?? "");
  const [experience, setExperience] = useState<ExperienceLevel>("mid");
  const [result, setResult] = useState<SalaryResult | null>(null);

  const selectedCountry = POPULAR_COUNTRIES.find((c) => c.name === country) ?? POPULAR_COUNTRIES[0];

  const handleExplore = () => {
    setResult(estimateSalary({ job: job || t("careersPage.salary.defaultRole"), country, city, experience }));
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-2">
        <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="type-heading">{t("careersPage.salary.title")}</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("careersPage.salary.subtitle")}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="salary-job" className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("careersPage.salary.job")}</Label>
          <Input id="salary-job" value={job} onChange={(e) => setJob(e.target.value)} placeholder={t("careersPage.salary.defaultRole")} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("careersPage.salary.country")}</Label>
          <Select value={country} onValueChange={(v) => { setCountry(v); const c = POPULAR_COUNTRIES.find((x) => x.name === v); setCity(c?.cities[0]?.name ?? ""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {POPULAR_COUNTRIES.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("careersPage.salary.city")}</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {selectedCountry.cities.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("careersPage.filter.experience.label")}</Label>
          <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleExplore} className="mt-5 font-semibold">
        <TrendingUp className="me-2 h-4 w-4" aria-hidden="true" />
        {t("careersPage.salary.explore")}
      </Button>

      {result && (
        <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            {result.role} — {result.city}, {result.country} ({t(`careersPage.filter.experience.${result.experience}`)})
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">{t("careersPage.salary.p25")}</p>
              <p className="text-lg font-bold">{result.currency} {result.p25.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-primary/10 py-2">
              <p className="text-xs text-primary">{t("careersPage.salary.median")}</p>
              <p className="text-xl font-black text-primary">{result.currency} {result.median.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("careersPage.salary.p75")}</p>
              <p className="text-lg font-bold">{result.currency} {result.p75.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("careersPage.salary.sampleSize").replace("{count}", result.sampleSize.toLocaleString())}
          </p>
        </div>
      )}
    </div>
  );
}
