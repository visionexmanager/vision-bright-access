import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Landmark, ArrowLeft, Heart, History, Columns3, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UniversityCard } from "@/components/academy/universities/UniversityCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  searchUniversitiesLocal, getAllUniversityCountries, getFavoriteUniversityIds,
  getUniversityByIdLocal, getRecentlyViewedUniversities, type LocalUniversityFilters,
} from "@/lib/academy/universityLocalStore";
import type { AcademyUniversityRow } from "@/lib/types/academy-modules";

export default function AcademyUniversities() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const query = searchParams.get("q") ?? "";
  const country = searchParams.get("country") ?? "";
  const sort = (searchParams.get("sort") as LocalUniversityFilters["sort"]) ?? "ranking";

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const results = useMemo(
    () => searchUniversitiesLocal({ query, country: country || undefined, sort }),
    [query, country, sort]
  );
  const countries = useMemo(() => getAllUniversityCountries(), [results]);

  const favoriteUniversities = useMemo(
    () => (user ? getFavoriteUniversityIds(user.id).map(getUniversityByIdLocal).filter((u): u is AcademyUniversityRow => u !== null) : []),
    [user]
  );
  const recentlyViewed = useMemo(() => (user ? getRecentlyViewedUniversities(user.id, 4) : []), [user]);

  const compareUniversities = compareIds.map(getUniversityByIdLocal).filter((u): u is AcademyUniversityRow => u !== null);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev));
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={Landmark}
            title="دليل الجامعات"
            description={`${results.length} جامعة متاحة`}
            headingId="universities-heading"
            action={compareIds.length > 0 ? <CompareCountBadge count={compareIds.length} /> : undefined}
          />
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-3" role="search" aria-label="بحث وتصفية الجامعات">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="university-search" className="sr-only">ابحث عن جامعة</label>
            <Input id="university-search" value={query} onChange={(e) => updateParam("q", e.target.value)} placeholder="ابحث عن جامعة..." className="ps-11 rounded-xl" />
          </div>
          <Select value={country || "all"} onValueChange={(v) => updateParam("country", v === "all" ? "" : v)}>
            <SelectTrigger className="md:w-44 rounded-xl" aria-label="البلد"><SelectValue placeholder="كل البلدان" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البلدان</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
            <SelectTrigger className="md:w-40 rounded-xl" aria-label="الترتيب"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ranking">الترتيب العالمي</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="new">الأحدث</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {favoriteUniversities.length > 0 && (
          <section aria-labelledby="favorite-universities-heading">
            <AcademySectionHeader icon={Heart} title="الجامعات المفضّلة" headingId="favorite-universities-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteUniversities.map((u) => <UniversityCard key={u.id} university={u} />)}
            </div>
          </section>
        )}

        {recentlyViewed.length > 0 && (
          <section aria-labelledby="recent-universities-heading">
            <AcademySectionHeader icon={History} title="شوهدت مؤخراً" headingId="recent-universities-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentlyViewed.map((u) => <UniversityCard key={u.id} university={u} />)}
            </div>
          </section>
        )}

        {/* Compare tray */}
        {compareUniversities.length > 0 && (
          <section aria-labelledby="compare-heading" className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <AcademySectionHeader
              icon={Columns3}
              title="مقارنة الجامعات"
              headingId="compare-heading"
              action={<Button variant="ghost" size="sm" onClick={() => setCompareIds([])} className="gap-1 rounded-xl"><X className="w-3.5 h-3.5" aria-hidden="true" />مسح</Button>}
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المعيار</TableHead>
                    {compareUniversities.map((u) => <TableHead key={u.id}>{u.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-medium">البلد</TableCell>{compareUniversities.map((u) => <TableCell key={u.id}>{u.country}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="font-medium">الترتيب العالمي</TableCell>{compareUniversities.map((u) => <TableCell key={u.id}>{u.ranking_global ?? "—"}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="font-medium">الرسوم الدراسية</TableCell>{compareUniversities.map((u) => <TableCell key={u.id}>{u.tuition_fee_range ?? "—"}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="font-medium">المنح المتاحة</TableCell>{compareUniversities.map((u) => <TableCell key={u.id}>{u.has_scholarships ? "نعم" : "لا"}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="font-medium">التقييم</TableCell>{compareUniversities.map((u) => <TableCell key={u.id}>{u.rating_avg?.toFixed(1) ?? "—"}</TableCell>)}</TableRow>
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <section aria-labelledby="university-results-heading">
          <h2 id="university-results-heading" className="sr-only">نتائج البحث</h2>
          {results.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl space-y-2">
              <Landmark className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                {query || country ? "لا توجد جامعات مطابقة لبحثك." : "لا توجد جامعات مضافة بعد — قاعدة البيانات جاهزة لاستقبال بيانات الجامعات."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="نتائج الجامعات">
              {results.map((u) => (
                <div role="listitem" key={u.id} className="space-y-2">
                  <UniversityCard university={u} />
                  <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(u.id)}
                      onChange={() => toggleCompare(u.id)}
                      disabled={!compareIds.includes(u.id) && compareIds.length >= 4}
                      className="w-3.5 h-3.5"
                    />
                    إضافة للمقارنة
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function CompareCountBadge({ count }: { count: number }) {
  return (
    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">
      {count} للمقارنة
    </span>
  );
}
