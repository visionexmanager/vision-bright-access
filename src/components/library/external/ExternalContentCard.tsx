import { forwardRef, useId } from "react";
import { Download, ExternalLink, Play, Eye, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ExternalContentItem } from "@/services/library/externalContent";

/** "h:mm:ss" or "m:ss". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

/** What the primary action does for this item, or null when it can only be opened at the source. */
export function previewAction(item: ExternalContentItem): "play" | "read" | "view" | null {
  if (!item.previewUrl && !item.embedUrl && !item.needsResolve) return null;
  if (["audio", "video", "podcast", "radio"].includes(item.contentType)) return "play";
  if (item.contentType === "book" || item.contentType === "document") return "read";
  return "view";
}

const ACTION_ICON = { play: Play, read: BookOpen, view: Eye } as const;

interface Props {
  item: ExternalContentItem;
  onPreview: (item: ExternalContentItem) => void;
}

/**
 * One external result. The title is a heading so screen-reader users can
 * move result to result; the source, licence and credit are plain text in
 * reading order, and every link that leaves Visionex says so.
 */
export const ExternalContentCard = forwardRef<HTMLHeadingElement, Props>(function ExternalContentCard({ item, onPreview }, headingRef) {
  const { t } = useLanguage();
  const titleId = useId();
  const action = previewAction(item);
  const newTab = <span className="sr-only"> ({t("library.researchAssistant.external.opensInNewTab")})</span>;
  const thumbAlt = item.contentType === "image" ? (item.altText ?? item.title) : "";
  const ActionIcon = action ? ACTION_ICON[action] : null;

  return (
    <Card className="flex h-full flex-col overflow-hidden" role="article" aria-labelledby={titleId}>
      {item.thumbnailUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={item.thumbnailUrl}
            alt={thumbAlt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 id={titleId} ref={headingRef} tabIndex={-1} dir="auto" className="line-clamp-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {item.title}
        </h3>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{t(`library.openSources.type.${item.contentType}`)}</Badge>
          {item.durationSeconds ? (
            <Badge variant="outline">{t("library.openSources.duration").replace("{time}", formatDuration(item.durationSeconds))}</Badge>
          ) : null}
        </div>
        <p className="text-xs font-medium">{t("library.openSources.source").replace("{provider}", item.providerName)}</p>
        {item.creator && (
          <p dir="auto" className="line-clamp-1 text-xs text-muted-foreground">{t("library.openSources.by").replace("{creator}", item.creator)}</p>
        )}
        {item.description && <p dir="auto" className="line-clamp-3 text-xs text-muted-foreground">{item.description}</p>}
        <p className="text-xs">
          {item.license ? (
            item.license.url ? (
              <a href={item.license.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {t("library.openSources.license").replace("{license}", item.license.name)}
                {newTab}
              </a>
            ) : (
              t("library.openSources.license").replace("{license}", item.license.name)
            )
          ) : (
            <span className="text-muted-foreground">{t("library.openSources.licenseUnknown")}</span>
          )}
        </p>
        {item.attribution && (
          <p dir="auto" className="line-clamp-2 text-xs text-muted-foreground">
            <span className="font-medium">{t("library.openSources.credit")}: </span>{item.attribution}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {action && ActionIcon && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onPreview(item)}
              aria-label={`${t(`library.openSources.action.${action}`)}: ${item.title}`}
            >
              <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(`library.openSources.action.${action}`)}
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t("library.openSources.open").replace("{provider}", item.providerName)}
              <span className="sr-only">: {item.title}</span>
              {newTab}
            </a>
          </Button>
          {item.downloadUrl && (
            <Button asChild size="sm" variant="ghost" className="gap-1.5">
              <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("library.openSources.download")}
                <span className="sr-only">: {item.title}</span>
                {newTab}
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});
