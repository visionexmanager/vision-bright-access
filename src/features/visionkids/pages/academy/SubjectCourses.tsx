import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSubjectBySlug, useCoursesBySubject } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { CourseCard } from "@/features/visionkids/components/academy/CourseCard";
import type { AcademyAgeRange } from "@/features/visionkids/types/academy.types";

const AGE_RANGES: AcademyAgeRange[] = ["3-5", "6-8", "9-12", "13-15"];

export default function SubjectCourses() {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const { t } = useLanguage();
  const [ageFilter, setAgeFilter] = useState<AcademyAgeRange | "all">("all");

  const { data: subject } = useSubjectBySlug(subjectSlug);
  const { data: courses = [], isLoading } = useCoursesBySubject(subjectSlug, ageFilter === "all" ? undefined : ageFilter);

  useDocumentHead({ title: subject?.name ?? t("kids.academy.coursesTitle"), description: t("kids.academy.meta.description"), canonicalPath: `/kids/academy/subject/${subjectSlug}` });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">{subject?.name ?? t("kids.academy.coursesTitle")}</h1>
      {subject?.description && <p className="mt-1 text-muted-foreground">{subject.description}</p>}

      <div role="group" aria-label={t("kids.academy.filterByAge")} className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAgeFilter("all")}
          aria-pressed={ageFilter === "all"}
          className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${ageFilter === "all" ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:bg-muted"}`}
        >
          {t("kids.stories.allAges")}
        </button>
        {AGE_RANGES.map((age) => (
          <button
            key={age}
            type="button"
            onClick={() => setAgeFilter(age)}
            aria-pressed={ageFilter === age}
            className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${ageFilter === age ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:bg-muted"}`}
          >
            {age}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : courses.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.academy.noCoursesYet")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      )}
    </div>
  );
}
