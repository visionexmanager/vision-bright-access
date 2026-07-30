import { useLanguage } from "@/contexts/LanguageContext";
import { ProjectCard } from "@/features/visionkids/components/studio/ProjectCard";
import type { CreativeProject } from "@/features/visionkids/types/studio.types";

export function ProjectGallery({ projects, isLoading, emptyKey = "kids.studio.noProjectsYet" }: { projects: CreativeProject[]; isLoading?: boolean; emptyKey?: string }) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  if (projects.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">{t(emptyKey)}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
    </div>
  );
}
