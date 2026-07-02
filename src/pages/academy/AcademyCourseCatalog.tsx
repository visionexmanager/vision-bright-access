import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, LayoutGrid, ArrowLeft } from "lucide-react";
import { CourseCard } from "@/components/academy/lms/CourseCard";
import { AICourseRequestCard } from "@/components/academy/lms/AICourseRequestCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { searchCourses, getAllCategories, type MockCourseFilters } from "@/lib/academy/mockCourses";

export default function AcademyCourseCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const source = searchParams.get("source") ?? "";
  const sort = (searchParams.get("sort") as MockCourseFilters["sort"]) ?? "featured";

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const results = useMemo(
    () => searchCourses({ query, category: category || undefined, difficulty: difficulty || undefined, source: source || undefined, sort }),
    [query, category, difficulty, source, sort]
  );

  const categories = useMemo(() => getAllCategories(), []);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={LayoutGrid}
            title="استكشف الدورات"
            description={`${results.length} دورة متاحة`}
            headingId="catalog-heading"
          />
        </div>

        <AICourseRequestCard />

        {/* Filters */}
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-3" role="search" aria-label="بحث وتصفية الدورات">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="catalog-search" className="sr-only">ابحث عن دورة</label>
            <Input
              id="catalog-search"
              value={query}
              onChange={(e) => updateParam("q", e.target.value)}
              placeholder="ابحث عن دورة..."
              className="ps-11 rounded-xl"
            />
          </div>

          <Select value={category || "all"} onValueChange={(v) => updateParam("category", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-44 rounded-xl" aria-label="الفئة">
              <SelectValue placeholder="كل الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={difficulty || "all"} onValueChange={(v) => updateParam("difficulty", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="المستوى">
              <SelectValue placeholder="كل المستويات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستويات</SelectItem>
              <SelectItem value="beginner">مبتدئ</SelectItem>
              <SelectItem value="intermediate">متوسط</SelectItem>
              <SelectItem value="advanced">متقدّم</SelectItem>
            </SelectContent>
          </Select>

          <Select value={source || "all"} onValueChange={(v) => updateParam("source", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-44 rounded-xl" aria-label="المصدر">
              <SelectValue placeholder="كل المصادر" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المصادر</SelectItem>
              <SelectItem value="visionex">Visionex الأصلية</SelectItem>
              <SelectItem value="marketplace">سوق المدرّسين</SelectItem>
              <SelectItem value="youtube">يوتيوب تعليمي</SelectItem>
              <SelectItem value="ai">بالذكاء الاصطناعي</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="الترتيب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">مميزة</SelectItem>
              <SelectItem value="popular">الأكثر شعبية</SelectItem>
              <SelectItem value="new">الأحدث</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 border-2 border-dashed border-border rounded-3xl">
            لا توجد دورات مطابقة لبحثك. جرّب كلمات أو فلاتر مختلفة.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="نتائج الدورات">
            {results.map((course) => (
              <div role="listitem" key={course.id}>
                <CourseCard course={course} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
