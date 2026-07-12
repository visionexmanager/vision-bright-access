import { useState, useEffect } from "react";
import { Pencil, MapPin, Github, Linkedin, Link2, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCareerProfile } from "@/hooks/career/useCareerProfile";
import { CareerErrorState } from "../../../ui/CareerErrorState";
import type { CareerProfilePatch } from "@/services/career/profile";

const LINK_FIELDS = [
  { key: "github_url" as const, icon: Github },
  { key: "linkedin_url" as const, icon: Linkedin },
  { key: "portfolio_url" as const, icon: Link2 },
  { key: "website_url" as const, icon: Globe },
];

type Draft = Required<Pick<CareerProfilePatch, "headline" | "bio" | "location" | "github_url" | "linkedin_url" | "portfolio_url" | "website_url">>;

const EMPTY_DRAFT: Draft = { headline: "", bio: "", location: "", github_url: "", linkedin_url: "", portfolio_url: "", website_url: "" };

export function ProfileHeader() {
  const { t } = useLanguage();
  const { profile, isLoading, error, refetch, saveProfile, isSaving } = useCareerProfile();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDraft({
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      github_url: profile.github_url ?? "",
      linkedin_url: profile.linkedin_url ?? "",
      portfolio_url: profile.portfolio_url ?? "",
      website_url: profile.website_url ?? "",
    });
  }, [profile]);

  if (isLoading) {
    return <div className="rounded-2xl border border-border/60 bg-card p-6 animate-pulse h-40" aria-hidden="true" />;
  }
  if (error) {
    return <CareerErrorState message={error} onRetry={refetch} className="rounded-2xl border border-border/60 bg-card" />;
  }

  const fullName = profile?.display_name?.trim() || t("careerDash.profile.unnamed");
  const initials = fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const links = LINK_FIELDS.filter(({ key }) => profile?.[key]);

  const openEditor = () => setOpen(true);

  const save = async () => {
    await saveProfile(draft);
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {initials || "?"}
          </span>
          <div>
            <h1 className="text-xl font-bold">{fullName}</h1>
            <p className="text-sm text-primary">{profile?.headline || t("careerDash.profile.noHeadline")}</p>
            {profile?.location && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {profile.location}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEditor}>
          <Pencil className="me-2 h-3.5 w-3.5" aria-hidden="true" />
          {t("careerDash.profile.edit")}
        </Button>
      </div>

      {profile?.bio && <p className="mt-4 max-w-2xl text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}

      {links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {links.map(({ key, icon: Icon }) => (
            <a
              key={key}
              href={profile![key]!.startsWith("http") ? profile![key]! : `https://${profile![key]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {profile![key]}
            </a>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("careerDash.profile.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="profile-headline">{t("careerDash.profile.headline")}</Label>
              <Input id="profile-headline" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="profile-location">{t("careerDash.profile.location")}</Label>
              <Input id="profile-location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="profile-bio">{t("careerDash.profile.bio")}</Label>
              <Textarea id="profile-bio" rows={4} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
            </div>
            {LINK_FIELDS.map(({ key }) => (
              <div key={key}>
                <Label htmlFor={`profile-${key}`}>{t(`careerDash.profile.link.${key}`)}</Label>
                <Input id={`profile-${key}`} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={save} disabled={isSaving}>{isSaving ? t("careerDash.profile.saving") : t("careerDash.profile.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
