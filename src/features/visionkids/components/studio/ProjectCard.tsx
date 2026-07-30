import { Link } from "react-router-dom";
import { Globe, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import { getProjectTypeIcon } from "@/features/visionkids/data/projectTypeIcons";
import type { CreativeProject } from "@/features/visionkids/types/studio.types";

const TOOL_ROUTE: Record<CreativeProject["project_type"], string> = {
  story: "story-creator", book: "book-creator", drawing: "drawing-studio", character: "character-builder",
  comic: "comic-creator", sticker: "sticker-maker", music: "music-studio", voice: "voice-studio",
  video: "video-creator", cartoon_scene: "cartoon-creator",
};

export function ProjectCard({ project }: { project: CreativeProject }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const Icon = getProjectTypeIcon(project.project_type);

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link
        to={`/kids/studio/${TOOL_ROUTE[project.project_type]}/${project.id}`}
        className="group block overflow-hidden rounded-2xl border-2 border-border bg-card transition-colors hover:border-kids-primary/50"
        aria-label={project.title}
      >
        <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-kids-primary/20 to-kids-purple/20">
          {project.thumbnail_url ? (
            <img src={project.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Icon className="h-10 w-10 text-foreground/40" aria-hidden="true" />
          )}
          <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/90">
            {project.is_public ? <Globe className="h-3.5 w-3.5 text-kids-secondary" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
          </span>
        </div>
        <div className="p-2.5">
          <p className="line-clamp-1 text-sm font-bold">{project.title}</p>
          <p className="text-xs text-muted-foreground">{t(`kids.studio.type.${project.project_type}`)}</p>
        </div>
      </Link>
    </motion.div>
  );
}
