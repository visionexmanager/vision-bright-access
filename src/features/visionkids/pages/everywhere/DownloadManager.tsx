import { useEffect, useState } from "react";
import { Trash2, HardDrive } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useDownloads, useRemoveDownload } from "@/features/visionkids/hooks/everywhere/useEverywhere";
import { storageEstimate } from "@/features/visionkids/everywhere/offlineDb";
import { EverywhereHeader } from "@/features/visionkids/components/everywhere/EverywhereShell";

const KIND_EMOJI: Record<string, string> = { story: "📖", audio: "🎧", lesson: "🎓", game: "🎮", quiz: "🧠", worksheet: "📝" };

export default function DownloadManager() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: downloads = [], isLoading } = useDownloads();
  const remove = useRemoveDownload();
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null);

  useEffect(() => { storageEstimate().then(setStorage).catch(() => {}); }, []);

  useDocumentHead({ title: `${t("kids.everywhere.nav.downloads")} — VisionKids`, description: t("kids.everywhere.downloads.subtitle"), canonicalPath: "/kids/everywhere/downloads" });

  const totalKb = downloads.reduce((sum, d) => sum + d.size_kb, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EverywhereHeader emoji="⬇️" title={t("kids.everywhere.nav.downloads")} subtitle={t("kids.everywhere.downloads.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.everywhere.signInHint")}</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
            <HardDrive className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" />
            <div>
              <p className="font-heading font-bold">{(totalKb / 1024).toFixed(1)} MB {t("kids.everywhere.downloads.onThisAccount")}</p>
              {storage && <p className="text-xs text-muted-foreground">{t("kids.everywhere.downloads.deviceStorage")}: {storage.usedMb} / {storage.quotaMb} MB</p>}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : downloads.length === 0 ? (
            <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.everywhere.downloads.empty")}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {downloads.map((d) => (
                <li key={`${d.content_kind}:${d.ref_id}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3">
                  <span className="text-2xl" aria-hidden="true">{KIND_EMOJI[d.content_kind] ?? "📦"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading font-bold leading-tight">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{t(`kids.everywhere.downloadKind.${d.content_kind}`)} · {(d.size_kb / 1024).toFixed(1)} MB</p>
                  </div>
                  <button type="button" onClick={() => remove.mutate({ kind: d.content_kind, refId: d.ref_id })} disabled={remove.isPending}
                    className="rounded-full p-2 text-kids-pink hover:bg-kids-pink/10" title={t("kids.everywhere.downloads.delete")}>
                    <Trash2 className="h-4 w-4" aria-label={t("kids.everywhere.downloads.delete")} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
