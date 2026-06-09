import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RadioSubscription } from "@/hooks/useRadioSubscription";

type Props = {
  subscription:  RadioSubscription | null | undefined;
  isSubscribed:  boolean;
  daysRemaining: number;
  className?:    string;
};

export function RadioSubscriptionStatus({ subscription, isSubscribed, daysRemaining, className }: Props) {
  const { t, lang } = useLanguage();

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
        {t("liveRadio.notSubscribed")}
      </Badge>
    );
  }

  const expiresDate = new Date(subscription.expires_at).toLocaleDateString(dateLocale, {
    day: "numeric", month: "long", year: "numeric",
  });

  const daysLabel = `${daysRemaining} ${t(daysRemaining === 1 ? "liveRadio.day" : "liveRadio.days")}`;

  return (
    <Badge
      className={cn(
        "gap-1.5",
        isSubscribed
          ? "bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/20"
          : "bg-red-500/15 text-red-600 border-red-500/30",
        className
      )}
      variant="outline"
    >
      {isSubscribed ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {daysRemaining <= 3
            ? t("liveRadio.expiresIn").replace("{n}", daysLabel)
            : `${lang === "ar" ? subscription.plan_name_ar : subscription.plan_name} — ${expiresDate}`}
        </>
      ) : (
        <>
          <Clock className="w-3.5 h-3.5" />
          {t("liveRadio.expired")}
        </>
      )}
    </Badge>
  );
}
