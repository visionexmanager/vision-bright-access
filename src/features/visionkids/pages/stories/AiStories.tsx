import { Link } from "react-router-dom";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyAiStories, useDeleteAiStory } from "@/features/visionkids/hooks/stories/useAiStoryGenerator";

export default function AiStories() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stories = [], isLoading } = useMyAiStories();
  const deleteStory = useDeleteAiStory();

  useDocumentHead({ title: t("kids.ai.libraryTitle"), description: t("kids.ai.subtitle"), canonicalPath: "/kids/stories/ai" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <Sparkles className="h-6 w-6 text-kids-purple" aria-hidden="true" /> {t("kids.ai.libraryTitle")}
        </h1>
        <Button asChild className="gap-1.5 bg-kids-purple text-white hover:bg-kids-purple/90">
          <Link to="/kids/stories/ai/create"><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.ai.createNew")}</Link>
        </Button>
      </div>
      <p className="mt-1 text-muted-foreground">{t("kids.ai.subtitle")}</p>

      {!user ? (
        <div className="mt-10 text-center">
          <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
          <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
        </div>
      ) : isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : stories.length === 0 ? (
        <div className="mt-10 text-center text-muted-foreground">{t("kids.ai.empty")}</div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {stories.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <div className="min-w-0">
                <Link to={`/kids/stories/ai/${s.id}`} className="line-clamp-1 font-heading font-bold hover:underline">{s.title || t("kids.ai.untitled")}</Link>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">"{s.prompt}"</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteStory.mutate(s.id)} aria-label={t("kids.ai.delete")}>
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
