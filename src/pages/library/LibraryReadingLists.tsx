import { useState, FormEvent } from "react";
import { ListChecks, Plus, Trash2, Share2, Users } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReadingLists } from "@/hooks/library/useReadingLists";
import { useReadingListShares } from "@/hooks/library/useReadingListShares";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryReadingListRow } from "@/services/library/readingLists";

function ShareListDialog({ list }: { list: LibraryReadingListRow }) {
  const { t } = useLanguage();
  const { shares, share, unshare, isSharing } = useReadingListShares(list.id);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("library.readingLists.share")}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.readingLists.shareTitle").replace("{name}", list.name)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("library.readingLists.shareEmailPlaceholder")} />
            <Button
              onClick={async () => {
                const ok = await share(email);
                if (ok) setEmail("");
              }}
              disabled={isSharing || !email.trim()}
            >
              {t("library.readingLists.shareAction")}
            </Button>
          </div>
          {shares.length > 0 && (
            <ul className="space-y-1">
              {shares.map((s) => (
                <li key={s.shared_with_user_id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {s.shared_with_user_id.slice(0, 8)}…</span>
                  <Button variant="ghost" size="sm" onClick={() => void unshare(s.shared_with_user_id)}>{t("library.readingLists.unshare")}</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LibraryReadingLists() {
  const { t } = useLanguage();
  const { lists, sharedLists, createList, deleteList, setVisibility } = useReadingLists();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibilityDraft] = useState<LibraryReadingListRow["visibility"]>("private");
  const [listType, setListType] = useState<LibraryReadingListRow["list_type"]>("personal");

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void createList(name.trim(), undefined, visibility, listType);
    setName("");
    setVisibilityDraft("private");
    setListType("personal");
    setOpen(false);
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.nav.readingLists")}
        breadcrumb={[{ label: t("library.nav.readingLists") }]}
        headerActions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("library.readingLists.create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("library.readingLists.createTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="reading-list-name">{t("library.readingLists.nameLabel")}</Label>
                  <Input id="reading-list-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reading-list-visibility">{t("library.readingLists.visibility")}</Label>
                    <Select value={visibility} onValueChange={(v) => setVisibilityDraft(v as LibraryReadingListRow["visibility"])}>
                      <SelectTrigger id="reading-list-visibility"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">{t("library.readingLists.visibility.private")}</SelectItem>
                        <SelectItem value="shared">{t("library.readingLists.visibility.shared")}</SelectItem>
                        <SelectItem value="public">{t("library.readingLists.visibility.public")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reading-list-type">{t("library.readingLists.type")}</Label>
                    <Select value={listType} onValueChange={(v) => setListType(v as LibraryReadingListRow["list_type"])}>
                      <SelectTrigger id="reading-list-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">{t("library.readingLists.type.personal")}</SelectItem>
                        <SelectItem value="course">{t("library.readingLists.type.course")}</SelectItem>
                        <SelectItem value="school">{t("library.readingLists.type.school")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{t("library.readingLists.create")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        {lists.length === 0 && sharedLists.length === 0 ? (
          <EmptyState icon={<ListChecks className="h-10 w-10" />} title={t("library.emptyState.noReadingListsTitle")} description={t("library.emptyState.noReadingListsDesc")} />
        ) : (
          <div className="space-y-8">
            {lists.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {lists.map((list) => (
                  <Card key={list.id} role="listitem">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                      <div>
                        <CardTitle className="text-base">{list.name}</CardTitle>
                        <div className="mt-1 flex gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{t(`library.readingLists.visibility.${list.visibility}`)}</Badge>
                          {list.list_type !== "personal" && <Badge variant="secondary" className="text-[10px]">{t(`library.readingLists.type.${list.list_type}`)}</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0">
                        <ShareListDialog list={list} />
                        <Button variant="ghost" size="icon" onClick={() => void deleteList(list.id)} aria-label={t("library.readingLists.delete")}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">{list.book_ids.length} {t("library.categories.books")}</p>
                      <Select value={list.visibility} onValueChange={(v) => void setVisibility(list.id, v as LibraryReadingListRow["visibility"])}>
                        <SelectTrigger className="h-8 text-xs" aria-label={t("library.readingLists.visibility")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">{t("library.readingLists.visibility.private")}</SelectItem>
                          <SelectItem value="shared">{t("library.readingLists.visibility.shared")}</SelectItem>
                          <SelectItem value="public">{t("library.readingLists.visibility.public")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {sharedLists.length > 0 && (
              <section aria-labelledby="shared-lists-heading">
                <h2 id="shared-lists-heading" className="mb-4 text-lg font-semibold">{t("library.readingLists.sharedWithMe")}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                  {sharedLists.map((list) => (
                    <Card key={list.id} role="listitem">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{list.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{list.book_ids.length} {t("library.categories.books")}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
