import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Plus, Search, Lock, Globe, KeyRound } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useClubBrowser } from "@/hooks/library/useClubs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryClubRow, LibraryClubVisibility } from "@/services/library/clubs";

const VISIBILITY_ICON: Record<LibraryClubVisibility, typeof Globe> = { public: Globe, private: Lock, invite_only: KeyRound };

function ClubCard({ club }: { club: LibraryClubRow }) {
  const { t } = useLanguage();
  const VisIcon = VISIBILITY_ICON[club.visibility];
  return (
    <Link to={`/library/clubs/${club.slug}`}>
      <Card className="h-full p-4 transition-shadow hover:shadow-md">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-semibold">{club.name}</h3>
          <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
            <VisIcon className="h-3 w-3" aria-hidden="true" /> {t(`library.clubs.visibility.${club.visibility}`)}
          </Badge>
        </div>
        {club.description && <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{club.description}</p>}
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" aria-hidden="true" /> {club.member_count}</p>
      </Card>
    </Link>
  );
}

export default function LibraryClubs() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { clubs, myClubs, isLoading, query, setQuery, create, isCreating } = useClubBrowser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<LibraryClubVisibility>("public");
  const [rules, setRules] = useState("");

  useDocumentHead({ title: t("library.clubs.title") });

  const handleCreate = async () => {
    const club = await create({ name: name.trim(), description: description.trim() || null, visibility, rules: rules.trim() || null });
    if (club) {
      setOpen(false);
      setName("");
      setDescription("");
      setRules("");
    }
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.clubs.title")}
        breadcrumb={[{ label: t("library.clubs.title") }]}
        headerActions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.clubs.create")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.clubs.createTitle")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="club-name">{t("library.clubs.nameLabel")}</Label>
                    <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="club-description">{t("library.clubs.descriptionLabel")}</Label>
                    <Textarea id="club-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label>{t("library.clubs.visibilityLabel")}</Label>
                    <Select value={visibility} onValueChange={(v) => setVisibility(v as LibraryClubVisibility)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t("library.clubs.visibility.public")}</SelectItem>
                        <SelectItem value="private">{t("library.clubs.visibility.private")}</SelectItem>
                        <SelectItem value="invite_only">{t("library.clubs.visibility.invite_only")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="club-rules">{t("library.clubs.rulesLabel")}</Label>
                    <Textarea id="club-rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => void handleCreate()} disabled={isCreating || !name.trim()}>{t("library.clubs.create")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        <div className="space-y-8">
          {myClubs.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("library.clubs.myClubs")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myClubs.map((club) => <ClubCard key={club.id} club={club} />)}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("library.clubs.discover")}</h2>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("library.clubs.searchPlaceholder")} className="ps-9" />
              </div>
            </div>
            {isLoading ? (
              <SkeletonLoader variant="grid" />
            ) : clubs.length === 0 ? (
              <EmptyState icon={<Users className="h-10 w-10" />} title={t("library.clubs.empty")} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clubs.map((club) => <ClubCard key={club.id} club={club} />)}
              </div>
            )}
          </section>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
