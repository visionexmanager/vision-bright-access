import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useConnection } from "@/features/visionkids/everywhere/useConnection";
import { flush, pendingCount } from "@/features/visionkids/everywhere/syncEngine";
import { offlineAvailable } from "@/features/visionkids/everywhere/offlineDb";
import { EverywhereHeader, ConnectionBadge } from "@/features/visionkids/components/everywhere/EverywhereShell";
import type { SyncStatus } from "@/features/visionkids/types/everywhere.types";

const OFFLINE_ITEMS = ["stories", "audio", "lessons", "games", "quizzes", "worksheets", "progress", "achievements", "dailyTasks", "drafts"];

export default function OfflineCenter() {
  const { t } = useLanguage();
  const { online } = useConnection();
  const [pending, setPending] = useState(0);
  const [sync, setSync] = useState<SyncStatus>("idle");

  useDocumentHead({ title: `${t("kids.everywhere.nav.offline")} — VisionKids`, description: t("kids.everywhere.offline.subtitle"), canonicalPath: "/kids/everywhere/offline" });

  useEffect(() => { if (offlineAvailable()) pendingCount().then(setPending).catch(() => {}); }, []);

  async function syncNow() {
    setSync("syncing");
    try {
      await flush();
      setSync("complete");
      if (offlineAvailable()) setPending(await pendingCount());
      setTimeout(() => setSync("idle"), 2500);
    } catch { setSync("failed"); setTimeout(() => setSync("idle"), 3000); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <EverywhereHeader emoji="📴" title={t("kids.everywhere.nav.offline")} subtitle={t("kids.everywhere.offline.subtitle")} />
        <div className="mt-8"><ConnectionBadge sync={sync} /></div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold">{pending > 0 ? t("kids.everywhere.offline.pending").replace("{n}", String(pending)) : t("kids.everywhere.offline.allSynced")}</p>
          <p className="text-xs text-muted-foreground">{online ? t("kids.everywhere.offline.onlineHint") : t("kids.everywhere.offline.offlineHint")}</p>
        </div>
        <button type="button" onClick={syncNow} disabled={!online || sync === "syncing"}
          className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${sync === "syncing" ? "animate-spin" : ""}`} aria-hidden="true" /> {t("kids.everywhere.offline.syncNow")}
        </button>
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold">{t("kids.everywhere.offline.worksOffline")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OFFLINE_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl border-2 border-kids-green/30 bg-kids-green/5 p-3 text-sm font-semibold">
              <span aria-hidden="true">✅</span> {t(`kids.everywhere.offlineItem.${item}`)}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">🔊 {t("kids.everywhere.offline.a11yNote")}</p>
      </section>
    </div>
  );
}
