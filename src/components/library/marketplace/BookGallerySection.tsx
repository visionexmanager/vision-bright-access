import { useState } from "react";
import { Images } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBookGallery } from "@/hooks/library/useBookGallery";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookGallerySectionProps {
  bookId: string;
}

export function BookGallerySection({ bookId }: BookGallerySectionProps) {
  const { t } = useLanguage();
  const { gallery, isLoading } = useBookGallery(bookId);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (isLoading || gallery.length === 0) return null;

  return (
    <section aria-labelledby="book-gallery-heading">
      <h2 id="book-gallery-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Images className="h-4 w-4" aria-hidden="true" /> {t("library.bookDetails.gallery")}
      </h2>
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {gallery.map((item) => (
            <CarouselItem key={item.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4">
              {item.media_type === "video" ? (
                <video src={item.url} controls className="aspect-video w-full rounded-lg bg-muted object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.url)}
                  className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                >
                  <img src={item.url} alt={item.caption ?? ""} loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                </button>
              )}
              {item.caption && <p className="mt-1 truncate text-xs text-muted-foreground">{item.caption}</p>}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex" />
        <CarouselNext className="hidden sm:flex" />
      </Carousel>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">{t("library.bookDetails.gallery")}</DialogTitle>
          {lightboxUrl && <img src={lightboxUrl} alt="" className="w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
