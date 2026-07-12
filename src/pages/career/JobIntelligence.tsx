// Still mock — pure aggregate labor-market analytics (world map, salary
// trends, skill demand, visa/remote intel) with no per-user data and no
// matching tables at all; would need an external market-data pipeline or
// career_analytics_events aggregation, not user-scoped CRUD. Future phase.
import { lazy, Suspense } from "react";
import { IntelligenceHeader } from "@/components/career/intelligence/IntelligenceHeader";
import { GlobalOverview } from "@/components/career/intelligence/GlobalOverview";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import "@/components/career/intelligence/IntelligenceTokens.css";

const WorldJobMap = lazy(() => import("@/components/career/intelligence/WorldJobMap").then((m) => ({ default: m.WorldJobMap })));
const TrendAnalytics = lazy(() => import("@/components/career/intelligence/TrendAnalytics").then((m) => ({ default: m.TrendAnalytics })));
const SalaryEngine = lazy(() => import("@/components/career/intelligence/SalaryEngine").then((m) => ({ default: m.SalaryEngine })));
const FakeJobDetector = lazy(() => import("@/components/career/intelligence/FakeJobDetector").then((m) => ({ default: m.FakeJobDetector })));
const SkillDemandEngine = lazy(() => import("@/components/career/intelligence/SkillDemandEngine").then((m) => ({ default: m.SkillDemandEngine })));
const RemoteIntelligence = lazy(() => import("@/components/career/intelligence/RemoteIntelligence").then((m) => ({ default: m.RemoteIntelligence })));
const VisaIntelligence = lazy(() => import("@/components/career/intelligence/VisaIntelligence").then((m) => ({ default: m.VisaIntelligence })));
const CompanyIntelligence = lazy(() => import("@/components/career/intelligence/CompanyIntelligence").then((m) => ({ default: m.CompanyIntelligence })));
const CareerForecastAI = lazy(() => import("@/components/career/intelligence/CareerForecastAI").then((m) => ({ default: m.CareerForecastAI })));
const RegionalInsights = lazy(() => import("@/components/career/intelligence/RegionalInsights").then((m) => ({ default: m.RegionalInsights })));

function SectionFallback() {
  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SkeletonCard count={3} />
      </div>
    </div>
  );
}

export default function JobIntelligence() {
  return (
    <div data-intelligence className="min-h-screen">
      <IntelligenceHeader />
      <GlobalOverview />
      <Suspense fallback={<SectionFallback />}><WorldJobMap /></Suspense>
      <Suspense fallback={<SectionFallback />}><TrendAnalytics /></Suspense>
      <Suspense fallback={<SectionFallback />}><SalaryEngine /></Suspense>
      <Suspense fallback={<SectionFallback />}><FakeJobDetector /></Suspense>
      <Suspense fallback={<SectionFallback />}><SkillDemandEngine /></Suspense>
      <Suspense fallback={<SectionFallback />}><RemoteIntelligence /></Suspense>
      <Suspense fallback={<SectionFallback />}><VisaIntelligence /></Suspense>
      <Suspense fallback={<SectionFallback />}><CompanyIntelligence /></Suspense>
      <Suspense fallback={<SectionFallback />}><CareerForecastAI /></Suspense>
      <Suspense fallback={<SectionFallback />}><RegionalInsights /></Suspense>
    </div>
  );
}
