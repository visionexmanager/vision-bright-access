import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, KeyRound, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyFamily, useEnsureMyFamily, useRenameMyFamily, useMyChildren, useUnlinkChild } from "@/features/visionkids/hooks/academy/useAcademyParent";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";

export default function FamilyAccounts() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: family } = useMyFamily();
  const ensureFamily = useEnsureMyFamily();
  const renameFamily = useRenameMyFamily();
  const { data: children = [] } = useMyChildren();
  const unlinkChild = useUnlinkChild();

  const { data: profiles = [] } = useProfiles(children.map((c) => c.child_user_id));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  const [familyNameDraft, setFamilyNameDraft] = useState("");

  useDocumentHead({ title: `${t("kids.social.family.title")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/parents/family" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Home className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.family.title")}
      </h1>

      <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4">
        {family ? (
          <div className="flex items-center gap-2">
            <Input value={familyNameDraft || family.family_name} onChange={(e) => setFamilyNameDraft(e.target.value)} maxLength={60} />
            <Button size="sm" onClick={() => familyNameDraft && renameFamily.mutate(familyNameDraft)} disabled={!familyNameDraft || renameFamily.isPending}>
              {t("kids.social.family.save")}
            </Button>
          </div>
        ) : (
          <Button onClick={() => ensureFamily.mutate()} disabled={ensureFamily.isPending}>{t("kids.social.family.createFamily")}</Button>
        )}
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Users className="h-5 w-5" aria-hidden="true" /> {t("kids.social.family.children")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("kids.social.family.childrenHint")}</p>

      <div className="mt-3 flex flex-col gap-2">
        {children.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("kids.social.family.noChildren")}</p>}
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3">
            <p className="font-semibold">{profileMap.get(c.child_user_id)?.display_name || t("kids.social.friends.unknownUser")}</p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/kids/social/parents/dashboard?child=${c.child_user_id}`}>{t("kids.social.parents.viewDashboard")}</Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => unlinkChild.mutate(c.id)} aria-label={t("kids.social.family.unlink")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-border p-4 text-center">
        <KeyRound className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-1 text-sm text-muted-foreground">{t("kids.social.family.linkHint")}</p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/kids/academy/parents">{t("kids.social.family.linkChild")}</Link>
        </Button>
      </div>
    </div>
  );
}
