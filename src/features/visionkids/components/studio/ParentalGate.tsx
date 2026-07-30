import { Globe, Lock, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyLinkedParents } from "@/features/visionkids/hooks/academy/useAcademyParent";
import type { CreativeProject } from "@/features/visionkids/types/studio.types";

interface ParentalGateProps {
  project: Pick<CreativeProject, "is_public" | "parent_approved">;
  onToggle: (next: boolean) => void;
}

/** "Parental Controls: review before sharing, full privacy, ability to hide
 *  the gallery" — a linked child sharing publicly is flagged for parent
 *  review (parent_approved starts NULL/pending; the parent flips it in
 *  their dashboard, see kids_creative_projects' RLS). Kids with no linked
 *  parent can publish immediately. */
export function ParentalGate({ project, onToggle }: ParentalGateProps) {
  const { t } = useLanguage();
  const { data: parents = [] } = useMyLinkedParents();
  const hasParent = parents.length > 0;
  const pending = project.is_public && hasParent && project.parent_approved === null;
  const rejected = project.parent_approved === false;

  return (
    <div className="rounded-xl border-2 border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="kids-studio-public" className="flex items-center gap-2 text-sm font-semibold">
          {project.is_public ? <Globe className="h-4 w-4 text-kids-secondary" aria-hidden="true" /> : <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          {t("kids.studio.shareToGallery")}
        </Label>
        <Switch id="kids-studio-public" checked={project.is_public} onCheckedChange={onToggle} />
      </div>
      {hasParent && (
        <p className="mt-2 text-xs text-muted-foreground">{t("kids.studio.parentReviewNote")}</p>
      )}
      {pending && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-kids-accent">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.studio.awaitingParentReview")}
        </p>
      )}
      {rejected && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.studio.parentDidNotApprove")}
        </p>
      )}
    </div>
  );
}
