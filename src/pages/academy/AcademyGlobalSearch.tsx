import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { CourseCard } from "@/components/academy/lms/CourseCard";
import { InstructorMiniCard } from "@/components/academy/lms/InstructorMiniCard";
import { ResourceCard } from "@/components/academy/library/ResourceCard";
import { ScholarshipCard } from "@/components/academy/scholarships/ScholarshipCard";
import { UniversityCard } from "@/components/academy/universities/UniversityCard";
import {
  Search, ArrowLeft, BookOpen, Library, GraduationCap, Landmark, Users,
  HeartHandshake, Sparkles,
} from "lucide-react";
import { runGlobalSearch, getTotalResultCount } from "@/lib/academy/globalSearch";

const STATIC_DESTINATIONS = [
  { keywords: ["خدمات", "مذاكرة", "إرشاد", "تقوية", "دعم فني", "student services"], label: "خدمات الطالب", href: "/academy#student-services-heading", icon: HeartHandshake },
  { keywords: ["منير", "ذكاء اصطناعي", "محادثة", "chat", "ai"], label: "مركز التعلّم الذكي (منير)", href: "/academy#ai-learning-center", icon: Sparkles },
];

export default function AcademyGlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const results = useMemo(() => runGlobalSearch(query), [query]);
  const totalCount = getTotalResultCount(results);

  const matchedDestinations = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return STATIC_DESTINATIONS.filter((d) => d.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase())));
  }, [query]);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={Search}
            title="بحث شامل في الأكاديمية"
            description="ابحث في الدورات، المكتبة، المنح، الجامعات، والمدرّسين دفعة واحدة"
            headingId="global-search-heading"
          />
        </div>

        <div className="relative">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="global-search-input" className="sr-only">ابحث في كل الأكاديمية</label>
          <Input
            id="global-search-input"
            value={query}
            onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
            placeholder="ابحث عن أي شيء في الأكاديمية..."
            className="ps-11 py-6 rounded-2xl text-base"
            autoFocus
          />
        </div>

        {!query.trim() ? (
          <p className="text-center text-muted-foreground py-16">ابدأ بالكتابة للبحث في كل أقسام الأكاديمية.</p>
        ) : totalCount === 0 && matchedDestinations.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl">
            <p className="text-muted-foreground">لا توجد نتائج مطابقة لـ "{query}".</p>
          </div>
        ) : (
          <div className="space-y-10">
            {matchedDestinations.length > 0 && (
              <section>
                <div className="flex flex-wrap gap-3">
                  {matchedDestinations.map((d) => (
                    <Button key={d.label} variant="outline" asChild className="gap-2 rounded-xl">
                      <Link to={d.href}><d.icon className="w-4 h-4" aria-hidden="true" />{d.label}</Link>
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {results.courses.length > 0 && (
              <section aria-labelledby="search-courses-heading">
                <AcademySectionHeader icon={BookOpen} title="الدورات" headingId="search-courses-heading" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.courses.map((c) => <CourseCard key={c.id} course={c} />)}
                </div>
              </section>
            )}

            {results.resources.length > 0 && (
              <section aria-labelledby="search-resources-heading">
                <AcademySectionHeader icon={Library} title="المكتبة الرقمية" headingId="search-resources-heading" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.resources.map((r) => <ResourceCard key={r.id} resource={r} />)}
                </div>
              </section>
            )}

            {results.scholarships.length > 0 && (
              <section aria-labelledby="search-scholarships-heading">
                <AcademySectionHeader icon={GraduationCap} title="المنح الدراسية" headingId="search-scholarships-heading" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.scholarships.map((s) => <ScholarshipCard key={s.id} scholarship={s} />)}
                </div>
              </section>
            )}

            {results.universities.length > 0 && (
              <section aria-labelledby="search-universities-heading">
                <AcademySectionHeader icon={Landmark} title="الجامعات" headingId="search-universities-heading" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.universities.map((u) => <UniversityCard key={u.id} university={u} />)}
                </div>
              </section>
            )}

            {results.instructors.length > 0 && (
              <section aria-labelledby="search-instructors-heading">
                <AcademySectionHeader icon={Users} title="المدرّسون" headingId="search-instructors-heading" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.instructors.map((i) => (
                    <Link key={i.id} to={`/academy/instructors/${i.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                      <InstructorMiniCard instructor={i} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
