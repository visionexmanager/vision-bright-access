import { Youtube } from "lucide-react";

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
}

/**
 * YouTube embedding only — never downloads or copies video content, per
 * YouTube's Terms of Service. Uses the standard privacy-enhanced embed URL.
 *
 * IDs prefixed with "SAMPLE_" are Phase 3 placeholder/demo content (see
 * src/lib/academy/mockCourses.ts) and render an inert preview instead of a
 * real iframe, so no unrelated real video is ever accidentally embedded.
 */
export function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  const isSample = videoId.startsWith("SAMPLE_");

  if (isSample) {
    return (
      <div
        className="aspect-video w-full rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground"
        role="img"
        aria-label={`فيديو يوتيوب تجريبي: ${title}`}
      >
        <Youtube className="w-10 h-10" aria-hidden="true" />
        <p className="text-sm">محتوى يوتيوب تجريبي — سيُستبدل بفيديو حقيقي عند ربط القناة</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
