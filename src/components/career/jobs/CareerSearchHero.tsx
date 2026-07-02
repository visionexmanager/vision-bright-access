import { useId, useState } from "react";
import { Search, MapPin, Briefcase, Wrench, GraduationCap, Coins, Building2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import { FilterChip } from "./FilterChip";
import type { ExperienceLevel, JobFilters, JobType, UpdateFilterFn, WorkMode } from "./types";

const JOB_TYPES: { value: JobType; labelKey: string }[] = [
  { value: "full-time", labelKey: "careersPage.filter.jobType.fullTime" },
  { value: "part-time", labelKey: "careersPage.filter.jobType.partTime" },
  { value: "contract", labelKey: "careersPage.filter.jobType.contract" },
  { value: "temporary", labelKey: "careersPage.filter.jobType.temporary" },
  { value: "internship", labelKey: "careersPage.filter.jobType.internship" },
  { value: "freelance", labelKey: "careersPage.filter.jobType.freelance" },
];

const WORK_MODES: { value: WorkMode; labelKey: string }[] = [
  { value: "remote", labelKey: "careersPage.filter.workMode.remote" },
  { value: "hybrid", labelKey: "careersPage.filter.workMode.hybrid" },
  { value: "onsite", labelKey: "careersPage.filter.workMode.onsite" },
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; labelKey: string }[] = [
  { value: "entry", labelKey: "careersPage.filter.experience.entry" },
  { value: "mid", labelKey: "careersPage.filter.experience.mid" },
  { value: "senior", labelKey: "careersPage.filter.experience.senior" },
  { value: "lead", labelKey: "careersPage.filter.experience.lead" },
];

interface CareerSearchHeroProps {
  filters: JobFilters;
  onUpdateFilter: UpdateFilterFn;
  onToggleJobType: (value: JobType) => void;
  onToggleWorkMode: (value: WorkMode) => void;
  onSubmit: () => void;
  resultCount: number;
}

export function CareerSearchHero({ filters, onUpdateFilter, onToggleJobType, onToggleWorkMode, onSubmit, resultCount }: CareerSearchHeroProps) {
  const { t } = useLanguage();
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const titleId = useId();
  const locationId = useId();
  const companyId = useId();
  const skillsId = useId();
  const countryId = useId();
  const salaryId = useId();
  const educationId = useId();

  return (
    <AnimatedSection variants={scaleFade} className="mx-auto max-w-5xl">
      <h1 id="careers-search-heading" className="type-display mb-3 text-center text-balance">
        {t("careersPage.hero.title")}
      </h1>
      <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground leading-relaxed">{t("careersPage.hero.subtitle")}</p>

      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        aria-labelledby="careers-search-heading"
        className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-lg backdrop-blur-md sm:p-6"
      >
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
          <div>
            <Label htmlFor={titleId} className="sr-only">{t("careersPage.filter.title")}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={titleId}
                value={filters.title}
                onChange={(e) => onUpdateFilter("title", e.target.value)}
                placeholder={t("careersPage.filter.titlePlaceholder")}
                className="h-12 ps-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={locationId} className="sr-only">{t("careersPage.filter.location")}</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={locationId}
                value={filters.location}
                onChange={(e) => onUpdateFilter("location", e.target.value)}
                placeholder={t("careersPage.filter.locationPlaceholder")}
                className="h-12 ps-9"
              />
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 px-8 font-semibold">
            {t("careersPage.filter.search")}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          aria-expanded={showMoreFilters}
          aria-controls="careers-more-filters"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t(showMoreFilters ? "careersPage.filter.hideMore" : "careersPage.filter.showMore")}
          <ChevronDown className={`h-4 w-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {showMoreFilters && (
          <div id="careers-more-filters" className="mt-4 flex flex-col gap-5 border-t border-border/50 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor={companyId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.company")}
                </Label>
                <Input id={companyId} value={filters.company} onChange={(e) => onUpdateFilter("company", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={skillsId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.skills")}
                </Label>
                <Input id={skillsId} value={filters.skills} onChange={(e) => onUpdateFilter("skills", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={countryId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.country")}
                </Label>
                <Input id={countryId} value={filters.country} onChange={(e) => onUpdateFilter("country", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={salaryId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.salary")}
                </Label>
                <Input id={salaryId} type="number" inputMode="numeric" min={0} value={filters.minSalary} onChange={(e) => onUpdateFilter("minSalary", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.experience.label")}
                </Label>
                <Select value={filters.experience || "any"} onValueChange={(v) => onUpdateFilter("experience", v === "any" ? "" : (v as ExperienceLevel))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("careersPage.filter.any")}</SelectItem>
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <SelectItem key={lvl.value} value={lvl.value}>{t(lvl.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={educationId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />{t("careersPage.filter.education")}
                </Label>
                <Input id={educationId} value={filters.education} onChange={(e) => onUpdateFilter("education", e.target.value)} />
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("careersPage.filter.workMode.label")}</legend>
              <div className="flex flex-wrap gap-2">
                {WORK_MODES.map((mode) => (
                  <FilterChip
                    key={mode.value}
                    id={`workmode-${mode.value}`}
                    label={t(mode.labelKey)}
                    checked={filters.workModes.includes(mode.value)}
                    onChange={() => onToggleWorkMode(mode.value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("careersPage.filter.jobType.label")}</legend>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPES.map((jt) => (
                  <FilterChip
                    key={jt.value}
                    id={`jobtype-${jt.value}`}
                    label={t(jt.labelKey)}
                    checked={filters.jobTypes.includes(jt.value)}
                    onChange={() => onToggleJobType(jt.value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("careersPage.filter.more")}</legend>
              <div className="flex flex-wrap gap-2">
                <FilterChip id="flag-visa" label={t("careersPage.filter.visaSponsorship")} checked={filters.visaSponsorship} onChange={(c) => onUpdateFilter("visaSponsorship", c)} />
                <FilterChip id="flag-accessible" label={t("careersPage.filter.accessibleJobs")} checked={filters.accessibleJobs} onChange={(c) => onUpdateFilter("accessibleJobs", c)} />
                <FilterChip id="flag-urgent" label={t("careersPage.filter.urgentHiring")} checked={filters.urgentHiring} onChange={(c) => onUpdateFilter("urgentHiring", c)} />
                <FilterChip id="flag-entry" label={t("careersPage.filter.entryLevel")} checked={filters.entryLevel} onChange={(c) => onUpdateFilter("entryLevel", c)} />
                <FilterChip id="flag-ai" label={t("careersPage.filter.aiJobs")} checked={filters.aiJobs} onChange={(c) => onUpdateFilter("aiJobs", c)} />
              </div>
            </fieldset>
          </div>
        )}

        <p className="mt-4 text-sm text-muted-foreground" role="status" aria-live="polite">
          {t("careersPage.filter.resultCount").replace("{count}", String(resultCount))}
        </p>
      </form>
    </AnimatedSection>
  );
}
