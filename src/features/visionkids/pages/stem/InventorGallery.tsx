import { useState } from "react";
import { Heart, Trash2, Globe, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useGalleryProjects, useMyProjects, useMyLikedIds,
  useToggleProjectLike, useDeleteProject, useSetProjectVisibility,
} from "@/features/visionkids/hooks/stem/useStemProjects";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import type { ProjectKind, StemProject } from "@/features/visionkids/types/stem.types";

const KIND_FILTERS: (ProjectKind | "all")[] = ["all", "invention", "robot", "design"];

export default function InventorGallery() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState<"gallery" | "mine">("gallery");
  const [kind, setKind] = useState<ProjectKind | "all">("all");

  const galleryKind = kind === "all" ? undefined : kind;
  const { data: gallery = [], isLoading: gLoading } = useGalleryProjects(galleryKind);
  const { data: mine = [], isLoading: mLoading } = useMyProjects(galleryKind || undefined);
  const { data: likedIds = [] } = useMyLikedIds();
  const toggleLike = useToggleProjectLike();
  const deleteProject = useDeleteProject();
  const setVisibility = useSetProjectVisibility();

  useDocumentHead({
    title: `${t("kids.stem.nav.gallery")} — VisionKids`,
    description: t("kids.stem.gallery.subtitle"),
    canonicalPath: "/kids/stem/gallery",
  });

  const likedSet = new Set(likedIds);
  const list = tab === "gallery" ? gallery : mine;
  const isLoading = tab === "gallery" ? gLoading : mLoading;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <StemHeader emoji="🖼️" title={t("kids.stem.nav.gallery")} subtitle={t("kids.stem.gallery.subtitle")} />

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => setTab("gallery")} aria-pressed={tab === "gallery"}
          className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${tab === "gallery" ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
          {t("kids.stem.gallery.public")}
        </button>
        {user && (
          <button type="button" onClick={() => setTab("mine")} aria-pressed={tab === "mine"}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${tab === "mine" ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            {t("kids.stem.gallery.myPortfolio")}
          </button>
        )}
      </div>

      {/* Kind filter */}
      <div className="mt-3 flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-current={kind === k ? "true" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${kind === k ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            {t(`kids.stem.gallery.filter.${k}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
          {tab === "mine" ? t("kids.stem.gallery.emptyMine") : t("kids.stem.gallery.empty")}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              mine={tab === "mine"}
              liked={likedSet.has(p.id)}
              canLike={!!user && p.user_id !== user.id}
              onLike={() => toggleLike.mutate(p.id)}
              onDelete={() => deleteProject.mutate(p.id)}
              onToggleVisibility={() => setVisibility.mutate({ projectId: p.id, isPublic: !p.is_public })}
              kindLabel={t(`kids.stem.gallery.filter.${p.kind}`)}
              makePublicLabel={t("kids.stem.gallery.makePublic")}
              makePrivateLabel={t("kids.stem.gallery.makePrivate")}
              deleteLabel={t("kids.stem.gallery.delete")}
              likeLabel={t("kids.stem.gallery.cheer")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project, mine, liked, canLike, onLike, onDelete, onToggleVisibility,
  kindLabel, makePublicLabel, makePrivateLabel, deleteLabel, likeLabel,
}: {
  project: StemProject;
  mine: boolean;
  liked: boolean;
  canLike: boolean;
  onLike: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  kindLabel: string;
  makePublicLabel: string;
  makePrivateLabel: string;
  deleteLabel: string;
  likeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4">
      <span className="text-4xl" aria-hidden="true">{project.emoji}</span>
      <p className="font-heading text-sm font-bold leading-tight">{project.title}</p>
      {project.description && <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">{kindLabel}</span>

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-kids-pink">
          <Heart className="h-3.5 w-3.5" fill={project.likes > 0 ? "currentColor" : "none"} aria-hidden="true" /> {project.likes}
        </span>
        {mine ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={onToggleVisibility} title={project.is_public ? makePrivateLabel : makePublicLabel}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
              {project.is_public ? <Globe className="h-4 w-4" aria-label={makePrivateLabel} /> : <Lock className="h-4 w-4" aria-label={makePublicLabel} />}
            </button>
            <button type="button" onClick={onDelete} title={deleteLabel}
              className="rounded-full p-1.5 text-kids-pink hover:bg-kids-pink/10">
              <Trash2 className="h-4 w-4" aria-label={deleteLabel} />
            </button>
          </div>
        ) : canLike ? (
          <button type="button" onClick={onLike} aria-pressed={liked} title={likeLabel}
            className={`rounded-full p-1.5 transition-colors ${liked ? "text-kids-pink" : "text-muted-foreground hover:text-kids-pink"}`}>
            <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} aria-label={likeLabel} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
