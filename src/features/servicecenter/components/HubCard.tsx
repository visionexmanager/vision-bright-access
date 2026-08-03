import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent } from "@/components/ui/card";
import * as Icons from "lucide-react";
import { HUB_ACCENT_CLASSES } from "../hubs";
import { pick } from "./localized";
import type { HubDefinition } from "../types";

interface HubCardProps {
  hub: HubDefinition;
  count: number;
  /** How many entries in this hub the visitor has completed. */
  completed?: number;
  active: boolean;
  onSelect: () => void;
}

/**
 * A hub is a promise, not a folder — the card leads with what the visitor gets
 * out of it and keeps the item count as secondary detail.
 */
export function HubCard({ hub, count, completed = 0, active, onSelect }: HubCardProps) {
  const { t, lang } = useLanguage();
  const { playSound } = useSound();

  const accent = HUB_ACCENT_CLASSES[hub.accent];
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[hub.icon] ?? Icons.Layers;
  const percent = count === 0 ? 0 : Math.round((completed / count) * 100);

  return (
    <button
      type="button"
      onClick={() => {
        onSelect();
        playSound("click");
      }}
      aria-pressed={active}
      className="group block h-full w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
    >
      <Card
        className={`h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
          active ? `${accent.border} ring-2 ring-inset ${accent.text}` : "border-border"
        }`}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${accent.gradient}`} aria-hidden="true" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <span className={`rounded-lg p-2.5 ${accent.chip}`} aria-hidden="true">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {t("sc.hub.count").replace("{n}", String(count))}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-bold leading-snug text-foreground">
            {pick(hub.title, lang)}
          </h3>
          <p className={`mt-1 text-sm font-medium ${accent.text}`}>{pick(hub.promise, lang)}</p>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {pick(hub.description, lang)}
          </p>

          {completed > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("sc.hub.progress")}</span>
                <span>
                  {completed}/{count}
                </span>
              </div>
              <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("sc.hub.progress")}
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${accent.gradient}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
}
