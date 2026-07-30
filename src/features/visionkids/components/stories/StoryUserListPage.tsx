import { Link } from "react-router-dom";
import { BookOpen, Heart, Clock, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useFavorites, useDownloads, useContinueReading, useReadingHistory,
} from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { StoryCard } from "@/features/visionkids/components/stories/StoryCard";
import type { Story } from "@/features/visionkids/types/stories.types";

export type StoryListKind = "favorites" | "downloads" | "continue-reading" | "history";

const ICONS: Record<StoryListKind, typeof Heart> = {
  favorites: Heart, downloads: Download, "continue-reading": Clock, history: BookOpen,
};

interface StoryUserListPageProps {
  kind: StoryListKind;
}

export function StoryUserListPage({ kind }: StoryUserListPageProps) {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  const favorites = useFavorites();
  const downloads = useDownloads();
  const continueReading = useContinueReading();
  const history = useReadingHistory();

  const titleKey = `kids.stories.list.${kind}.title`;
  const emptyKey = `kids.stories.list.${kind}.empty`;
  const Icon = ICONS[kind];

  useDocumentHead({ title: t(titleKey), description: t("kids.stories.meta.description"), canonicalPath: `/kids/stories/${kind}` });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  let content: React.ReactNode;

  if (kind === "favorites") {
    const stories = (favorites.data ?? []).map((f) => f.story).filter(Boolean) as Story[];
    content = stories.length === 0 ? null : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {stories.map((s) => <StoryCard key={s.id} story={s} />)}
      </div>
    );
  } else if (kind === "downloads") {
    const rows = downloads.data ?? [];
    content = rows.length === 0 ? null : (
      <ul className="flex flex-col gap-2">
        {rows.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-xl border-2 border-border p-3">
            <div>
              <p className="font-semibold">{d.story?.title}</p>
              <p className="text-xs text-muted-foreground">{d.format.toUpperCase()} · {new Date(d.downloaded_at).toLocaleDateString()}</p>
            </div>
            {d.story && <Link to={`/kids/stories/story/${d.story.slug}`} className="text-sm text-kids-primary hover:underline">{t("kids.stories.viewStory")}</Link>}
          </li>
        ))}
      </ul>
    );
  } else {
    const rows = kind === "continue-reading" ? (continueReading.data ?? []) : (history.data ?? []);
    content = rows.length === 0 ? null : (
      <ul className="flex flex-col gap-3">
        {rows.map((p) => (
          <li key={`${p.user_id}-${p.story_id}`} className="rounded-xl border-2 border-border p-3">
            <div className="flex items-center justify-between">
              <Link to={p.story ? `/kids/stories/read/${p.story.slug}` : "#"} className="font-semibold hover:underline">{p.story?.title}</Link>
              <span className="text-xs text-muted-foreground">{p.completed ? t("kids.stories.completed") : `${Math.round(p.progress_percent)}%`}</span>
            </div>
            <Progress value={p.progress_percent} className="mt-2" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold">
        <Icon className="h-6 w-6 text-kids-primary" aria-hidden="true" /> {t(titleKey)}
      </h1>
      <div className="mt-6">
        {content ?? <p className="text-center text-muted-foreground">{t(emptyKey)}</p>}
      </div>
    </div>
  );
}
