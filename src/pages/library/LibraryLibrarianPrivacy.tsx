import { Download, Pause, Play, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibrarianPrivacy } from "@/hooks/library/useLibrarianPrivacy";
import type { LibraryPrivacyCategory } from "@/services/library/librarianPrivacy";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const CATEGORIES: LibraryPrivacyCategory[] = [
  "highlights", "notes", "bookmarks", "chat_history", "recommendations", "daily_plans", "summaries", "goals", "favorite_topics",
];

export default function LibraryLibrarianPrivacy() {
  const { t } = useLanguage();
  const {
    requests, isLoading, memoryPaused, isExporting, isDeleting, isTogglingPause,
    doExport, doDeleteCategory, doDeleteAll, togglePause,
  } = useLibrarianPrivacy();
  const [selectedCategory, setSelectedCategory] = useState<LibraryPrivacyCategory>("highlights");

  useDocumentHead({ title: t("library.librarian.privacy.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.librarian.privacy.title")} breadcrumb={[{ label: t("library.librarian.title"), to: "/library/librarian" }, { label: t("library.librarian.privacy.title") }]}>
        <div className="space-y-6">
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              {memoryPaused ? <Pause className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : <Play className="h-5 w-5 text-primary" aria-hidden="true" />}
              <div>
                <Label htmlFor="pause-memory-switch" className="text-sm font-medium">{t("library.librarian.privacy.pauseMemory")}</Label>
                <p className="text-xs text-muted-foreground">{t("library.librarian.privacy.pauseMemoryDescription")}</p>
              </div>
            </div>
            <Switch id="pause-memory-switch" checked={memoryPaused} onCheckedChange={() => void togglePause()} disabled={isTogglingPause} aria-label={t("library.librarian.privacy.pauseMemory")} />
          </Card>

          <Card className="space-y-2 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Download className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.privacy.exportMemory")}</h2>
            <p className="text-sm text-muted-foreground">{t("library.librarian.privacy.exportMemoryDescription")}</p>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={isExporting} onClick={() => void doExport()}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              {t("library.librarian.privacy.downloadExport")}
            </Button>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Trash2 className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.privacy.selectiveMemory")}</h2>
            <p className="text-sm text-muted-foreground">{t("library.librarian.privacy.selectiveMemoryDescription")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as LibraryPrivacyCategory)}>
                <SelectTrigger className="w-56" aria-label={t("library.librarian.privacy.selectiveMemory")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`library.librarian.privacy.category.${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={isDeleting}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.librarian.privacy.deleteCategory")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("library.librarian.privacy.deleteCategoryConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("library.librarian.privacy.deleteCategoryConfirmDescription").replace("{category}", t(`library.librarian.privacy.category.${selectedCategory}`))}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("library.librarian.privacy.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void doDeleteCategory(selectedCategory)}>{t("library.librarian.privacy.confirmDelete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="border-t pt-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5" disabled={isDeleting}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.librarian.privacy.deleteAll")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("library.librarian.privacy.deleteAllConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("library.librarian.privacy.deleteAllConfirmDescription")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("library.librarian.privacy.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void doDeleteAll()}>{t("library.librarian.privacy.confirmDelete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.privacy.requestHistory")}</h2>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
            ) : requests.length === 0 ? (
              <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title={t("library.librarian.privacy.noRequests")} className="py-6" />
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Card className="flex items-center justify-between gap-2 p-3">
                      <div className="text-sm">
                        <span className="font-medium">{t(`library.librarian.privacy.requestType.${r.request_type}`)}</span>
                        {r.category && <span className="text-muted-foreground"> — {t(`library.librarian.privacy.category.${r.category}`)}</span>}
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant={r.status === "completed" ? "secondary" : r.status === "failed" ? "destructive" : "outline"} className="text-xs">
                        {t(`library.librarian.privacy.status.${r.status}`)}
                      </Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
