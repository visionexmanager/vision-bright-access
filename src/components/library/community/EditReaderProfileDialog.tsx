import { useEffect, useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { badgeVariants } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { LibraryReaderProfileRow, LibraryReaderProfileInput } from "@/services/library/readerProfile";
import type { LibraryCategoryRow } from "@/lib/types/library-book";
import type { LibraryAuthorRow } from "@/lib/types/library-author";

const SUPPORTED_LANGUAGES = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];

/** A toggleable chip — Badge itself renders a plain <div> (fine for
 *  read-only display elsewhere), but a clickable filter chip needs to be a
 *  real <button> with aria-pressed so it's keyboard-operable, not just
 *  mouse-clickable. */
function ToggleChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(badgeVariants({ variant: pressed ? "default" : "outline" }), "cursor-pointer")}
    >
      {children}
    </button>
  );
}

interface EditReaderProfileDialogProps {
  profile: LibraryReaderProfileRow;
  categories: LibraryCategoryRow[];
  authors: LibraryAuthorRow[];
  onSave: (input: LibraryReaderProfileInput) => Promise<void>;
}

export function EditReaderProfileDialog({ profile, categories, authors, onSave }: EditReaderProfileDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [genres, setGenres] = useState<string[]>(profile.favorite_genres);
  const [favAuthors, setFavAuthors] = useState<string[]>(profile.favorite_authors);
  const [languages, setLanguages] = useState<string[]>(profile.languages);
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [showReadingActivity, setShowReadingActivity] = useState(profile.show_reading_activity);
  const [showReviews, setShowReviews] = useState(profile.show_reviews);
  const [showReadingLists, setShowReadingLists] = useState(profile.show_reading_lists);
  const [showFollowers, setShowFollowers] = useState(profile.show_followers);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBio(profile.bio ?? "");
    setGenres(profile.favorite_genres);
    setFavAuthors(profile.favorite_authors);
    setLanguages(profile.languages);
    setIsPublic(profile.is_public);
    setShowReadingActivity(profile.show_reading_activity);
    setShowReviews(profile.show_reviews);
    setShowReadingLists(profile.show_reading_lists);
    setShowFollowers(profile.show_followers);
  }, [open, profile]);

  const toggleIn = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      bio: bio.trim() || null,
      favorite_genres: genres,
      favorite_authors: favAuthors,
      languages,
      is_public: isPublic,
      show_reading_activity: showReadingActivity,
      show_reviews: showReviews,
      show_reading_lists: showReadingLists,
      show_followers: showFollowers,
    });
    setIsSaving(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.profile.editProfile")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("library.profile.editProfile")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="profile-bio">{t("library.profile.bio")}</Label>
            <Textarea id="profile-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} />
          </div>

          <div>
            <Label className="mb-1.5 block">{t("library.profile.favoriteGenres")}</Label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
              {categories.map((c) => (
                <ToggleChip key={c.id} pressed={genres.includes(c.id)} onToggle={() => toggleIn(genres, setGenres, c.id)}>
                  {c.name}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">{t("library.profile.favoriteAuthors")}</Label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
              {authors.slice(0, 60).map((a) => (
                <ToggleChip key={a.id} pressed={favAuthors.includes(a.id)} onToggle={() => toggleIn(favAuthors, setFavAuthors, a.id)}>
                  {a.name}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">{t("library.profile.languages")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LANGUAGES.map((code) => (
                <ToggleChip key={code} pressed={languages.includes(code)} onToggle={() => toggleIn(languages, setLanguages, code)}>
                  {t(`library.language.${code}`)}
                </ToggleChip>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="block text-sm font-semibold">{t("library.profile.privacySettings")}</Label>
            <div className="flex items-center gap-2">
              <Checkbox id="priv-public" checked={isPublic} onCheckedChange={(v) => setIsPublic(v === true)} />
              <Label htmlFor="priv-public" className="text-sm font-normal">{t("library.profile.isPublic")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="priv-activity" checked={showReadingActivity} onCheckedChange={(v) => setShowReadingActivity(v === true)} />
              <Label htmlFor="priv-activity" className="text-sm font-normal">{t("library.profile.showReadingActivity")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="priv-reviews" checked={showReviews} onCheckedChange={(v) => setShowReviews(v === true)} />
              <Label htmlFor="priv-reviews" className="text-sm font-normal">{t("library.profile.showReviews")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="priv-lists" checked={showReadingLists} onCheckedChange={(v) => setShowReadingLists(v === true)} />
              <Label htmlFor="priv-lists" className="text-sm font-normal">{t("library.profile.showReadingLists")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="priv-followers" checked={showFollowers} onCheckedChange={(v) => setShowFollowers(v === true)} />
              <Label htmlFor="priv-followers" className="text-sm font-normal">{t("library.profile.showFollowers")}</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => void handleSave()} disabled={isSaving}>{t("library.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
