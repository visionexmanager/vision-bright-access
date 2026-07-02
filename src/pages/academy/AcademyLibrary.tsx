import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Library, ArrowLeft, BookOpen, Bookmark, Heart, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ResourceCard } from "@/components/academy/library/ResourceCard";
import { CollectionCard } from "@/components/academy/library/CollectionCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  searchResourcesLocal, getAllLibraryCategories, getCollectionsLocal,
  getBookmarkedResourceIds, getFavoriteResourceIds, getRecentlyOpenedResources,
  getResourceByIdLocal, type LocalLibraryFilters,
} from "@/lib/academy/libraryLocalStore";
import type { AcademyLibraryResourceRow } from "@/lib/types/academy-modules";

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "pdf", label: "PDF" }, { value: "book", label: "كتاب" }, { value: "ebook", label: "كتاب إلكتروني" },
  { value: "audiobook", label: "كتاب صوتي" }, { value: "research_paper", label: "بحث علمي" },
  { value: "scientific_article", label: "مقالة علمية" }, { value: "presentation", label: "عرض تقديمي" },
  { value: "document", label: "مستند" }, { value: "template", label: "قالب تعليمي" }, { value: "worksheet", label: "ورقة عمل" },
  { value: "study_guide", label: "دليل دراسي" }, { value: "exam_collection", label: "مجموعة امتحانات" },
  { value: "practice_material", label: "مواد تدريبية" }, { value: "cheat_sheet", label: "ورقة مرجعية" },
  { value: "infographic", label: "إنفوجرافيك" },
];

export default function AcademyLibrary() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const type = searchParams.get("type") ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const sort = (searchParams.get("sort") as LocalLibraryFilters["sort"]) ?? "recommended";

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const results = useMemo(
    () => searchResourcesLocal({ query, category: category || undefined, type: type || undefined, difficulty: difficulty || undefined, sort }),
    [query, category, type, difficulty, sort]
  );
  const categories = useMemo(() => getAllLibraryCategories(), [results]);
  const collections = useMemo(() => getCollectionsLocal(), []);

  const continueReading = useMemo(() => (user ? getRecentlyOpenedResources(user.id, 4) : []), [user]);
  const bookmarkedResources = useMemo(
    () => (user ? getBookmarkedResourceIds(user.id).map(getResourceByIdLocal).filter((r): r is AcademyLibraryResourceRow => r !== null) : []),
    [user]
  );
  const favoriteResources = useMemo(
    () => (user ? getFavoriteResourceIds(user.id).map(getResourceByIdLocal).filter((r): r is AcademyLibraryResourceRow => r !== null) : []),
    [user]
  );

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={Library}
            title="المكتبة الرقمية"
            description={`${results.length} مورد متاح`}
            headingId="library-heading"
          />
        </div>

        {/* Filters */}
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-3" role="search" aria-label="بحث وتصفية الموارد">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="library-search" className="sr-only">ابحث في المكتبة</label>
            <Input id="library-search" value={query} onChange={(e) => updateParam("q", e.target.value)} placeholder="ابحث عن عنوان، مؤلف، أو وسم..." className="ps-11 rounded-xl" />
          </div>
          <Select value={type || "all"} onValueChange={(v) => updateParam("type", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-48 rounded-xl" aria-label="نوع المورد"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty || "all"} onValueChange={(v) => updateParam("difficulty", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="المستوى"><SelectValue placeholder="كل المستويات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستويات</SelectItem>
              <SelectItem value="beginner">مبتدئ</SelectItem>
              <SelectItem value="intermediate">متوسط</SelectItem>
              <SelectItem value="advanced">متقدّم</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="الترتيب"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">موصى بها</SelectItem>
              <SelectItem value="popular">الأكثر شعبية</SelectItem>
              <SelectItem value="new">الأحدث</SelectItem>
              <SelectItem value="trending">الأكثر تداولاً</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => updateParam("category", category === c ? "" : c)}
                aria-pressed={category === c}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  category === c ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/60 border-border text-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Continue Reading / Bookmarks / Favorites — personal, only shown when non-empty */}
        {continueReading.length > 0 && (
          <section aria-labelledby="continue-reading-heading">
            <AcademySectionHeader icon={History} title="متابعة القراءة" headingId="continue-reading-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {continueReading.map((r) => <ResourceCard key={r.id} resource={r} />)}
            </div>
          </section>
        )}

        {(bookmarkedResources.length > 0 || favoriteResources.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookmarkedResources.length > 0 && (
              <section aria-labelledby="bookmarks-heading">
                <AcademySectionHeader icon={Bookmark} title="الإشارات المرجعية" headingId="bookmarks-heading" />
                <div className="space-y-2">{bookmarkedResources.slice(0, 3).map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
              </section>
            )}
            {favoriteResources.length > 0 && (
              <section aria-labelledby="favorites-heading">
                <AcademySectionHeader icon={Heart} title="المفضّلة" headingId="favorites-heading" />
                <div className="space-y-2">{favoriteResources.slice(0, 3).map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
              </section>
            )}
          </div>
        )}

        {collections.length > 0 && (
          <section aria-labelledby="collections-heading">
            <AcademySectionHeader icon={Library} title="مجموعات مختارة" headingId="collections-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((c) => <CollectionCard key={c.id} collection={c} />)}
            </div>
          </section>
        )}

        {/* Main results */}
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">نتائج البحث</h2>
          {results.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                {query || category || type || difficulty
                  ? "لا توجد موارد مطابقة لبحثك."
                  : "المكتبة فارغة حالياً — قاعدة البيانات جاهزة لاستقبال الموارد التي يضيفها فريق المحتوى."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="نتائج الموارد">
              {results.map((r) => <div role="listitem" key={r.id}><ResourceCard resource={r} /></div>)}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
