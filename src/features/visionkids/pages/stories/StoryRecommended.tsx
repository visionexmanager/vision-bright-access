import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useRecommendedStories } from "@/features/visionkids/hooks/stories/useStoryDiscovery";
import { StoryCard } from "@/features/visionkids/components/stories/StoryCard";

export default function StoryRecommended() {
  const { t } = useLanguage();
  const { data: stories = [], isLoading } = useRecommendedStories(30);

  useDocumentHead({ title: t("kids.stories.recommendedForYou"), description: t("kids.stories.meta.description"), canonicalPath: "/kids/stories/recommended" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Sparkles className="h-6 w-6 text-kids-accent" aria-hidden="true" /> {t("kids.stories.recommendedForYou")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.stories.recommendedSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {stories.map((s) => <StoryCard key={s.id} story={s} />)}
        </div>
      )}
    </div>
  );
}
