import { ShieldAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyReports } from "@/features/visionkids/hooks/social/useReports";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-kids-accent", reviewed: "text-kids-primary", dismissed: "text-muted-foreground", actioned: "text-kids-green",
};

export default function Reports() {
  const { t } = useLanguage();
  const { data: reports = [], isLoading } = useMyReports();

  useDocumentHead({ title: `${t("kids.social.reports.title")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/reports" });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" /> {t("kids.social.reports.title")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.social.reports.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : reports.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.reports.empty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t(`kids.social.report.reason.${r.reason}`)}</p>
                <span className={`text-xs font-bold uppercase ${STATUS_COLOR[r.status]}`}>{t(`kids.social.reports.status.${r.status}`)}</span>
              </div>
              {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
