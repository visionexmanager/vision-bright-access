import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, GraduationCap, ArrowLeft, Bookmark, History, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ScholarshipCard } from "@/components/academy/scholarships/ScholarshipCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  searchScholarshipsLocal, getAllScholarshipCountries, getSavedScholarshipIds,
  getScholarshipByIdLocal, getRecentlyViewedScholarships, type LocalScholarshipFilters,
} from "@/lib/academy/scholarshipLocalStore";
import type { AcademyScholarshipRow } from "@/lib/types/academy-modules";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "government", label: "حكومية" }, { value: "university", label: "جامعية" },
  { value: "private", label: "خاصة" }, { value: "research_grant", label: "منح بحثية" },
  { value: "exchange_program", label: "برامج تبادل" }, { value: "international", label: "دولية" },
  { value: "local", label: "محلية" }, { value: "online", label: "عبر الإنترنت" },
];

export default function AcademyScholarships() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const country = searchParams.get("country") ?? "";
  const category = searchParams.get("category") ?? "";
  const fundingLevel = searchParams.get("funding") ?? "";
  const sort = (searchParams.get("sort") as LocalScholarshipFilters["sort"]) ?? "deadline";

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const results = useMemo(
    () => searchScholarshipsLocal({ query, country: country || undefined, category: category || undefined, fundingLevel: fundingLevel || undefined, sort }),
    [query, country, category, fundingLevel, sort]
  );
  const countries = useMemo(() => getAllScholarshipCountries(), [results]);

  const savedScholarships = useMemo(
    () => (user ? getSavedScholarshipIds(user.id).map(getScholarshipByIdLocal).filter((s): s is AcademyScholarshipRow => s !== null) : []),
    [user]
  );
  const recentlyViewed = useMemo(() => (user ? getRecentlyViewedScholarships(user.id, 4) : []), [user]);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={GraduationCap}
            title="مركز المنح الدراسية"
            description={`${results.length} منحة متاحة`}
            headingId="scholarships-heading"
          />
        </div>

        {/* AI suggestions entry point — honest, generation out of scope */}
        <section aria-labelledby="ai-scholarship-heading" className="bg-gradient-to-br from-primary/10 via-card to-card rounded-3xl border border-border shadow-lg p-6">
          <AcademySectionHeader
            icon={Sparkles}
            title="اقتراحات منح مخصّصة لك"
            description="اسأل منير في مركز التعلّم الذكي عن منح تناسب تخصصك وبلدك"
            headingId="ai-scholarship-heading"
          />
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link to={`/academy?ask=${encodeURIComponent("اقترح عليّ منحاً دراسية تناسب تخصصي ومستواي الدراسي")}`}>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              اسأل منير عن منح مناسبة
            </Link>
          </Button>
        </section>

        {/* Filters */}
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-3" role="search" aria-label="بحث وتصفية المنح">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="scholarship-search" className="sr-only">ابحث عن منحة</label>
            <Input id="scholarship-search" value={query} onChange={(e) => updateParam("q", e.target.value)} placeholder="ابحث عن منحة أو جهة مانحة..." className="ps-11 rounded-xl" />
          </div>
          <Select value={country || "all"} onValueChange={(v) => updateParam("country", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="البلد"><SelectValue placeholder="كل البلدان" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البلدان</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category || "all"} onValueChange={(v) => updateParam("category", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-44 rounded-xl" aria-label="الفئة"><SelectValue placeholder="كل الفئات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fundingLevel || "all"} onValueChange={(v) => updateParam("funding", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="مستوى التمويل"><SelectValue placeholder="كل مستويات التمويل" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل مستويات التمويل</SelectItem>
              <SelectItem value="full">تمويل كامل</SelectItem>
              <SelectItem value="partial">تمويل جزئي</SelectItem>
              <SelectItem value="tuition_only">الرسوم فقط</SelectItem>
              <SelectItem value="stipend_only">راتب شهري فقط</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="الترتيب"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">الموعد النهائي</SelectItem>
              <SelectItem value="new">الأحدث</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {savedScholarships.length > 0 && (
          <section aria-labelledby="saved-scholarships-heading">
            <AcademySectionHeader icon={Bookmark} title="المنح المحفوظة" headingId="saved-scholarships-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedScholarships.map((s) => <ScholarshipCard key={s.id} scholarship={s} />)}
            </div>
          </section>
        )}

        {recentlyViewed.length > 0 && (
          <section aria-labelledby="recent-scholarships-heading">
            <AcademySectionHeader icon={History} title="شوهدت مؤخراً" headingId="recent-scholarships-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentlyViewed.map((s) => <ScholarshipCard key={s.id} scholarship={s} />)}
            </div>
          </section>
        )}

        <section aria-labelledby="scholarship-results-heading">
          <h2 id="scholarship-results-heading" className="sr-only">نتائج البحث</h2>
          {results.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl space-y-2">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                {query || country || category || fundingLevel
                  ? "لا توجد منح مطابقة لبحثك."
                  : "لا توجد منح مضافة بعد — قاعدة البيانات جاهزة لاستقبال المنح من فريق المحتوى."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="نتائج المنح">
              {results.map((s) => <div role="listitem" key={s.id}><ScholarshipCard scholarship={s} /></div>)}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
