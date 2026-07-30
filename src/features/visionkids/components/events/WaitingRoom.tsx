import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function WaitingRoom({ startsAt, title }: { startsAt: string; title: string }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const msLeft = new Date(startsAt).getTime() - now;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-kids-purple/40 bg-kids-purple/10 p-10 text-center">
      <Clock className="h-12 w-12 text-kids-purple" aria-hidden="true" />
      <p className="font-heading text-xl font-extrabold">{t("kids.events.waitingRoom.title")}</p>
      <p className="text-muted-foreground">{title}</p>
      <p className="font-mono text-3xl font-extrabold text-kids-purple" role="timer" aria-live="polite">{formatCountdown(msLeft)}</p>
      <p className="text-sm text-muted-foreground">{t("kids.events.waitingRoom.subtitle")}</p>
    </div>
  );
}
