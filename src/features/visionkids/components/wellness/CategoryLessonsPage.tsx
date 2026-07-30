import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useLessons } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { WELLNESS_COLOR_CLASSES } from "@/features/visionkids/data/wellnessConfig";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import type { WellnessCategory } from "@/features/visionkids/types/wellness.types";

/** Generic list page shared by Nutrition, Exercise Center, Mindfulness,
 *  Safety Academy, and First Aid Kids — one component, five categories,
 *  driven by props (same discipline as Explorer's world template). */
export function CategoryLessonsPage({
  category,
  emoji,
  title,
  subtitle,
  navId,
  disclaimer,
  canonicalPath,
}: {
  category: WellnessCategory;
  emoji: string;
  title: string;
  subtitle?: string;
  navId: string;
  disclaimer?: string;
  canonicalPath: string;
}) {
  const { t } = useLanguage();
  const { data: lessons = [], isLoading } = useLessons(category);

  useDocumentHead({ title: `${title} — VisionKids`, description: subtitle ?? t("kids.wellness.meta.description"), canonicalPath });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji={emoji} title={title} subtitle={subtitle} showSubNav activeId={navId} />

      {disclaimer && (
        <p className="mt-4 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3 text-sm font-medium" role="note">
          ⚠️ {disclaimer}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              to={`/kids/health/lesson/${category}/${lesson.slug}`}
              className={`flex flex-col gap-2 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.02] ${WELLNESS_COLOR_CLASSES[lesson.color]}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl" aria-hidden="true">{lesson.emoji}</span>
                <p className="font-heading text-base font-bold leading-tight">{lesson.title}</p>
              </div>
              {lesson.summary && <p className="text-sm text-foreground/70">{lesson.summary}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
