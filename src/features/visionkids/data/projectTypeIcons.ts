import {
  BookOpen, BookMarked, Palette, User, MessageSquareText, Sticker, Music, Mic, Video, Clapperboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProjectType } from "@/features/visionkids/types/studio.types";

export const PROJECT_TYPE_ICONS: Record<ProjectType, LucideIcon> = {
  story: BookOpen,
  book: BookMarked,
  drawing: Palette,
  character: User,
  comic: MessageSquareText,
  sticker: Sticker,
  music: Music,
  voice: Mic,
  video: Video,
  cartoon_scene: Clapperboard,
};

export function getProjectTypeIcon(type: ProjectType): LucideIcon {
  return PROJECT_TYPE_ICONS[type] ?? Palette;
}
