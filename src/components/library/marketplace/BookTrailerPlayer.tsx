import { Film } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookTrailerPlayerProps {
  trailerVideoUrl: string | null;
}

export function BookTrailerPlayer({ trailerVideoUrl }: BookTrailerPlayerProps) {
  const { t } = useLanguage();
  if (!trailerVideoUrl) return null;

  return (
    <section aria-labelledby="book-trailer-heading">
      <h2 id="book-trailer-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Film className="h-4 w-4" aria-hidden="true" /> {t("library.bookDetails.trailer")}
      </h2>
      <video src={trailerVideoUrl} controls preload="metadata" className="aspect-video w-full max-w-2xl rounded-xl bg-muted" />
    </section>
  );
}
