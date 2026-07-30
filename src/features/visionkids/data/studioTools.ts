import type { ProjectType } from "@/features/visionkids/types/studio.types";

export interface StudioTool {
  type: ProjectType;
  slug: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  color: "primary" | "secondary" | "accent" | "pink" | "green" | "purple";
}

/** The 10 Creative Studio tools. "story" links to the existing Phase 2 AI
 *  Story Generator (kids/stories/ai/create) instead of a new duplicate
 *  flow — see StudioHome's own comment. */
export const STUDIO_TOOLS: StudioTool[] = [
  { type: "story", slug: "/kids/stories/ai/create", emoji: "📖", titleKey: "kids.studio.tool.story.title", descKey: "kids.studio.tool.story.desc", color: "primary" },
  { type: "drawing", slug: "/kids/studio/drawing-studio/new", emoji: "🎨", titleKey: "kids.studio.tool.drawing.title", descKey: "kids.studio.tool.drawing.desc", color: "pink" },
  { type: "cartoon_scene", slug: "/kids/studio/cartoon-creator", emoji: "🎬", titleKey: "kids.studio.tool.cartoon_scene.title", descKey: "kids.studio.tool.cartoon_scene.desc", color: "purple" },
  { type: "character", slug: "/kids/studio/character-builder/new", emoji: "👦", titleKey: "kids.studio.tool.character.title", descKey: "kids.studio.tool.character.desc", color: "secondary" },
  { type: "music", slug: "/kids/studio/music-studio", emoji: "🎵", titleKey: "kids.studio.tool.music.title", descKey: "kids.studio.tool.music.desc", color: "green" },
  { type: "voice", slug: "/kids/studio/voice-studio", emoji: "🎤", titleKey: "kids.studio.tool.voice.title", descKey: "kids.studio.tool.voice.desc", color: "accent" },
  { type: "video", slug: "/kids/studio/video-creator", emoji: "🎥", titleKey: "kids.studio.tool.video.title", descKey: "kids.studio.tool.video.desc", color: "primary" },
  { type: "book", slug: "/kids/studio/book-creator/new", emoji: "📚", titleKey: "kids.studio.tool.book.title", descKey: "kids.studio.tool.book.desc", color: "secondary" },
  { type: "comic", slug: "/kids/studio/comic-creator", emoji: "🧩", titleKey: "kids.studio.tool.comic.title", descKey: "kids.studio.tool.comic.desc", color: "pink" },
  { type: "sticker", slug: "/kids/studio/sticker-maker/new", emoji: "🏷️", titleKey: "kids.studio.tool.sticker.title", descKey: "kids.studio.tool.sticker.desc", color: "accent" },
];
