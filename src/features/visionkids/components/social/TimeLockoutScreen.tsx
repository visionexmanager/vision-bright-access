import { Moon, Clock, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeLockoutScreenProps {
  reason: "daily_limit" | "bedtime" | "study_time";
}

const ICONS = { daily_limit: Clock, bedtime: Moon, study_time: BookOpen };

/** A real, honest guardrail — not a tamper-proof lock (see the usage
 *  service's own comment on the client-trust model). A cooperating family
 *  gets a clear, friendly stop screen; nothing here claims to be
 *  unbypassable. */
export function TimeLockoutScreen({ reason }: TimeLockoutScreenProps) {
  const { t } = useLanguage();
  const Icon = ICONS[reason];

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-kids-primary/10">
        <Icon className="h-10 w-10 text-kids-primary" aria-hidden="true" />
      </div>
      <h1 className="font-heading text-2xl font-extrabold">{t(`kids.social.lockout.${reason}.title`)}</h1>
      <p className="max-w-sm text-muted-foreground">{t(`kids.social.lockout.${reason}.subtitle`)}</p>
    </div>
  );
}
