import { useState } from "react";
import { Pencil, MapPin, Github, Linkedin, Link2, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MOCK_PROFILE } from "../../mock/mockProfile";
import type { UserProfile } from "../../types";

const LINK_ICONS = [
  { key: "github" as const, icon: Github },
  { key: "linkedin" as const, icon: Linkedin },
  { key: "portfolio" as const, icon: Link2 },
  { key: "website" as const, icon: Globe },
];

export function ProfileHeader() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE);
  const [draft, setDraft] = useState(profile);
  const [open, setOpen] = useState(false);
  const initials = profile.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");

  const openEditor = () => {
    setDraft(profile);
    setOpen(true);
  };

  const save = () => {
    setProfile(draft);
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
            style={{ backgroundColor: profile.avatarColor }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div>
            <h1 className="text-xl font-bold">{profile.fullName}</h1>
            <p className="text-sm text-primary">{profile.headline}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {profile.location}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEditor}>
          <Pencil className="me-2 h-3.5 w-3.5" aria-hidden="true" />
          {t("careerDash.profile.edit")}
        </Button>
      </div>

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {LINK_ICONS.map(({ key, icon: Icon }) => (
          <a
            key={key}
            href={`https://${profile.links[key]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {profile.links[key]}
          </a>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("careerDash.profile.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="profile-name">{t("careerDash.profile.fullName")}</Label>
              <Input id="profile-name" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={save}>{t("careerDash.profile.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
