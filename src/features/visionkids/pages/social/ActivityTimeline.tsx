import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, History, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyChildren } from "@/features/visionkids/hooks/academy/useAcademyParent";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";
import { useActivityTimeline } from "@/features/visionkids/hooks/social/useParentDashboard";
import { ChildSwitcher } from "@/features/visionkids/components/social/ChildSwitcher";

/** The reason string on each kids_xp_events row already reads like a
 *  friendly activity description (e.g. "Story completed: <id>") — this
 *  just strips the trailing id for display. */
function describeReason(reason: string): string {
  return reason.split(":")[0];
}

export default function ActivityTimeline() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const selectedChildId = params.get("child") ?? undefined;

  const { data: children = [] } = useMyChildren();
  const childIds = children.map((c) => c.child_user_id);
  const { data: profiles = [] } = useProfiles(childIds);
  const { data: entries = [], isLoading } = useActivityTimeline(selectedChildId);

  useDocumentHead({ title: `${t("kids.social.parents.timelineTitle")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/parents/timeline" });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to="/kids/social/parents/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.social.parents.dashboardTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><History className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.parents.timelineTitle")}</h1>
        <ChildSwitcher childUserIds={childIds} profiles={profiles} selectedChildId={selectedChildId} onSelect={(id) => setParams({ child: id })} />
      </div>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : entries.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.parents.timelineEmpty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3">
              <div>
                <p className="text-sm font-semibold">{describeReason(e.reason)}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-bold text-kids-accent"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> +{e.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
