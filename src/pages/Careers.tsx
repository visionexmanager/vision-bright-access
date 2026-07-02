import { lazy, Suspense, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection } from "@/components/AnimatedSection";
import { CareerSearchHero } from "@/components/career/jobs/CareerSearchHero";
import { AIJobSearchBar } from "@/components/career/jobs/AIJobSearchBar";
import { QuickCategories } from "@/components/career/jobs/QuickCategories";
import { JobCard } from "@/components/career/jobs/JobCard";
import { FloatingWidgets } from "@/components/career/jobs/FloatingWidgets";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import { useJobSearch } from "@/components/career/jobs/useJobSearch";
import type { ParsedAiQuery } from "@/components/career/jobs/types";
import { SearchX } from "lucide-react";

const FeaturedJobs = lazy(() => import("@/components/career/jobs/FeaturedJobs").then((m) => ({ default: m.FeaturedJobs })));
const RecommendedJobs = lazy(() => import("@/components/career/jobs/RecommendedJobs").then((m) => ({ default: m.RecommendedJobs })));
const LatestJobs = lazy(() => import("@/components/career/jobs/LatestJobs").then((m) => ({ default: m.LatestJobs })));
const TopCompanies = lazy(() => import("@/components/career/jobs/TopCompanies").then((m) => ({ default: m.TopCompanies })));
const PopularLocations = lazy(() => import("@/components/career/jobs/PopularLocations").then((m) => ({ default: m.PopularLocations })));
const CareerStatsDashboard = lazy(() => import("@/components/career/jobs/CareerStatsDashboard").then((m) => ({ default: m.CareerStatsDashboard })));
const SalaryExplorer = lazy(() => import("@/components/career/jobs/SalaryExplorer").then((m) => ({ default: m.SalaryExplorer })));
const CareerInsights = lazy(() => import("@/components/career/jobs/CareerInsights").then((m) => ({ default: m.CareerInsights })));
const AccessibilitySection = lazy(() => import("@/components/career/jobs/AccessibilitySection").then((m) => ({ default: m.AccessibilitySection })));
const CareerToolsGrid = lazy(() => import("@/components/career/jobs/CareerToolsGrid").then((m) => ({ default: m.CareerToolsGrid })));
const UserDashboardPreview = lazy(() => import("@/components/career/jobs/UserDashboardPreview").then((m) => ({ default: m.UserDashboardPreview })));
const EmployerDashboardPreview = lazy(() => import("@/components/career/jobs/EmployerDashboardPreview").then((m) => ({ default: m.EmployerDashboardPreview })));

function SectionFallback() {
  return <SkeletonCard count={3} />;
}

export default function Careers() {
  const { t } = useLanguage();
  const { filters, updateFilter, patchFilters, toggleJobType, toggleWorkMode, applyAiQuery, results } = useJobSearch();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAiApply = (parsed: ParsedAiQuery) => {
    applyAiQuery(parsed);
    setRecentSearches((prev) => [parsed.summary, ...prev].slice(0, 6));
    scrollToResults();
  };

  return (
    <Layout>
      <section className="relative overflow-hidden px-4 py-16" aria-label={t("careersPage.hero.title")}>
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent)]" />
        </div>
        <div className="section-container relative z-10 flex flex-col gap-8">
          <CareerSearchHero
            filters={filters}
            onUpdateFilter={updateFilter}
            onToggleJobType={toggleJobType}
            onToggleWorkMode={toggleWorkMode}
            onSubmit={scrollToResults}
            resultCount={results.length}
          />
          <AIJobSearchBar onApply={handleAiApply} />
        </div>
      </section>

      <section className="section-container py-12" aria-labelledby="careers-categories-heading">
        <h2 id="careers-categories-heading" className="type-heading mb-6 text-center">{t("careersPage.categories.title")}</h2>
        <QuickCategories onSelectCategory={(id) => { updateFilter("category", id); scrollToResults(); }} />
      </section>

      <section ref={resultsRef} className="section-container py-12 scroll-mt-24" aria-labelledby="careers-results-heading">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="careers-results-heading" className="type-heading">{t("careersPage.results.title")}</h2>
          <span className="text-sm text-muted-foreground">
            {t("careersPage.filter.resultCount").replace("{count}", String(results.length))}
          </span>
        </div>
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">{t("careersPage.results.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-16 py-4 sm:gap-20">
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><FeaturedJobs /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><RecommendedJobs /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><LatestJobs /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><TopCompanies /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><PopularLocations /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><CareerStatsDashboard /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><SalaryExplorer /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><CareerInsights /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><AccessibilitySection /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><CareerToolsGrid /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container">
          <Suspense fallback={<SectionFallback />}><UserDashboardPreview /></Suspense>
        </AnimatedSection>
        <AnimatedSection className="section-container pb-8">
          <Suspense fallback={<SectionFallback />}><EmployerDashboardPreview /></Suspense>
        </AnimatedSection>
      </div>

      <FloatingWidgets onQuickFilter={patchFilters} activeFilters={filters} recentSearches={recentSearches} />
    </Layout>
  );
}
