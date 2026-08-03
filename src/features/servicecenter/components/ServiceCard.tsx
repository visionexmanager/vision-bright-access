import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { ArrowRight, CheckCircle2, Clock, Coins, Sparkles } from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";
import { HUB_ACCENT_CLASSES, getHub } from "../hubs";
import { pick } from "./localized";
import type { ServiceEntry } from "../types";
import { DifficultyMeter } from "./DifficultyMeter";

interface ServiceCardProps {
  entry: ServiceEntry;
  /** True when the visitor has already completed this experience. */
  completed?: boolean;
  /** Optional "why this was suggested" line from the Navigator. */
  reason?: string;
}

/**
 * The card links to the service *profile*, never straight into a paid session.
 * That is the core of the restructure: a visitor decides from a page that
 * explains the outcome, cost and difficulty first.
 */
export function ServiceCard({ entry, completed, reason }: ServiceCardProps) {
  const { lang, t } = useLanguage();
  const { playSound } = useSound();

  const hub = getHub(entry.hub);
  const accent = HUB_ACCENT_CLASSES[hub?.accent ?? "sky"];
  const title = pick(entry.title, lang);
  const tagline = pick(entry.tagline, lang);

  const priceLabel = entry.vx === 0
    ? t("sc.free")
    : entry.usageBased
      ? t("sc.fromPerSession").replace("{price}", formatVX(entry.vx))
      : formatVX(entry.vx);

  return (
    <Link
      to={`/services/experience/${entry.slug}`}
      onClick={() => playSound("navigate")}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`${title} — ${tagline}`}
    >
      <Card
        className={`h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
          completed ? "border-emerald-500/40" : accent.border
        }`}
      >
        <div className="relative h-28 overflow-hidden">
          {entry.image ? (
            <img
              src={entry.image}
              alt=""
              role="presentation"
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${accent.gradient}`} aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

          {entry.recentlyAdded && (
            <span className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold text-foreground shadow-sm">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t("sc.new")}
            </span>
          )}
          {completed && (
            <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {t("sc.completed")}
            </span>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tagline}</p>

          {reason && (
            <p className={`mt-2 text-xs font-medium ${accent.text}`}>{reason}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <DifficultyMeter difficulty={entry.difficulty} />

            {entry.durationMinutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">{t("sc.duration")}</span>
                {t("sc.minutes").replace("{n}", String(entry.durationMinutes))}
              </span>
            )}

            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t("sc.cost")}</span>
              {priceLabel}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {hub ? pick(hub.title, lang) : null}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${accent.text}`}>
              {t("sc.viewDetails")}
              <ArrowRight
                className="h-3 w-3 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
