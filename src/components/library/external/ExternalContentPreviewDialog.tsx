import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { isAllowedEmbed, resolveExternalItem, type ExternalContentItem } from "@/services/library/externalContent";

/** Caption cues as plain text, for a transcript a screen reader can read at its own pace. */
export function vttToTranscript(vtt: string): string {
  return vtt
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).filter((line) => line && !/^WEBVTT|^NOTE|^\d+$|-->/.test(line)).join(" "))
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

interface Props {
  item: ExternalContentItem | null;
  onClose: () => void;
}

/**
 * Plays or shows one external item inside the Library. Nothing autoplays;
 * players are the browser's own controls or the provider's official embed,
 * and embeds are checked against the allow-list again here before an iframe
 * is ever rendered. Radix returns focus to the button that opened it.
 */
export function ExternalContentPreviewDialog({ item, onClose }: Props) {
  const { t } = useLanguage();
  const [resolved, setResolved] = useState<ExternalContentItem | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolved(null);
    setFailed(false);
    if (!item) return;
    if (!item.needsResolve) {
      setResolved(item);
      return;
    }
    let cancelled = false;
    resolveExternalItem(item.id)
      .then((full) => { if (!cancelled) setResolved(full); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [item]);

  const captionsSrc = useMemo(() => {
    if (!resolved?.captionsVtt || typeof URL.createObjectURL !== "function") return null;
    return URL.createObjectURL(new Blob([resolved.captionsVtt], { type: "text/vtt" }));
  }, [resolved]);
  useEffect(() => () => { if (captionsSrc) URL.revokeObjectURL(captionsSrc); }, [captionsSrc]);

  const shown = resolved ?? item;
  const embed = resolved && isAllowedEmbed(resolved.embedUrl) ? resolved.embedUrl : null;
  const media = resolved?.previewUrl ?? null;
  const kind = resolved?.contentType;
  const playable = !!(embed || media);
  const transcript = resolved?.captionsVtt ? vttToTranscript(resolved.captionsVtt) : "";

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {shown && (
          <>
            <DialogHeader>
              <DialogTitle dir="auto">{shown.title}</DialogTitle>
              <DialogDescription>
                {t("library.openSources.source").replace("{provider}", shown.providerName)}
                {shown.license ? ` · ${t("library.openSources.license").replace("{license}", shown.license.name)}` : ""}
              </DialogDescription>
            </DialogHeader>

            {!resolved && !failed && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("library.openSources.loadingMedia")}
              </p>
            )}

            {resolved && embed && (
              <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
                <iframe
                  src={embed}
                  title={t("library.openSources.playerTitle").replace("{title}", resolved.title).replace("{provider}", resolved.providerName)}
                  className="h-full w-full"
                  allow="fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
                  loading="lazy"
                />
              </div>
            )}

            {resolved && !embed && media && kind === "image" && (
              <img src={media} alt={resolved.altText ?? resolved.title} referrerPolicy="no-referrer" className="max-h-[60vh] w-full rounded-md object-contain" />
            )}

            {resolved && !embed && media && kind === "video" && (
              <video controls preload="metadata" playsInline poster={resolved.thumbnailUrl ?? undefined} className="w-full rounded-md bg-black">
                <source src={media} type={resolved.mimeType ?? undefined} />
                {captionsSrc && <track kind="captions" src={captionsSrc} srcLang={resolved.language ?? "en"} label={t("library.openSources.captions")} default />}
              </video>
            )}

            {resolved && !embed && media && (kind === "audio" || kind === "podcast" || kind === "radio") && (
              <audio controls preload="none" className="w-full" aria-label={t("library.openSources.audioLabel").replace("{title}", resolved.title)}>
                <source src={media} type={resolved.mimeType ?? undefined} />
              </audio>
            )}

            {(failed || (resolved && !playable)) && (
              <p role="status" className="text-sm text-muted-foreground">{t("library.openSources.mediaUnavailable")}</p>
            )}

            {resolved?.description && <p dir="auto" className="text-sm">{resolved.description}</p>}

            {transcript && (
              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">{t("library.openSources.transcript")}</summary>
                <p dir="auto" className="mt-2 whitespace-pre-line">{transcript}</p>
              </details>
            )}

            {shown.attribution && (
              <p dir="auto" className="text-xs text-muted-foreground">
                <span className="font-medium">{t("library.openSources.credit")}: </span>{shown.attribution}
              </p>
            )}

            <div>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={shown.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {shown.provider === "youtube" ? t("library.youtube.openOn") : t("library.openSources.open").replace("{provider}", shown.providerName)}
                  <span className="sr-only"> ({t("library.researchAssistant.external.opensInNewTab")})</span>
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
