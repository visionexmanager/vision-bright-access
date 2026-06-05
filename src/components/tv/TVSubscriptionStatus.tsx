import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TVSubscription } from "@/hooks/useTVSubscription";

type Props = {
  subscription:   TVSubscription | null | undefined;
  isSubscribed:   boolean;
  daysRemaining:  number;
  className?:     string;
};

export function TVSubscriptionStatus({ subscription, isSubscribed, daysRemaining, className }: Props) {
  const { t, lang } = useLanguage();

  // Locale map — falls back to "en-US"
  const localeMap: Record<string, string> = {
    ar: "ar-EG", en: "en-US", de: "de-DE", es: "es-ES",
    fr: "fr-FR", hi: "hi-IN", pt: "pt-BR", ru: "ru-RU",
    tr: "tr-TR", ur: "ur-PK", zh: "zh-CN",
  };
  const dateLocale = localeMap[lang] ?? "en-US";

  if (!subscription) {
    return (
      <Badge variant="outline" className={cn("gap-1.5 text-muted-foreground", className)}>
        <XCircle className="w-3.5 h-3.5" />
        {t("liveTV.notSubscribed")}
      </Badge>
    );
  }

  const expiresDate = new Date(subscription.expires_at).toLocaleDateString(dateLocale, {
    day: "numeric", month: "long", year: "numeric",
  });

  const daysLabel = `${daysRemaining} ${t(daysRemaining === 1 ? "liveTV.day" : "liveTV.days")}`;

  return (
    <Badge
      className={cn(
        "gap-1.5",
        isSubscribed
          ? "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20"
          : "bg-red-500/15 text-red-600 border-red-500/30",
        className
      )}
      variant="outline"
    >
      {isSubscribed ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {daysRemaining <= 3
            ? t("liveTV.expiresIn").replace("{n}", daysLabel)
            : `${lang === "ar" ? subscription.plan_name_ar : subscription.plan_name} — ${expiresDate}`}
        </>
      ) : (
        <>
          <Clock className="w-3.5 h-3.5" />
          {t("liveTV.expired")}
        </>
      )}
    </Badge>
  );
}
