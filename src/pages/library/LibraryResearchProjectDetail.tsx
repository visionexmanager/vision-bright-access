import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Trash2, Users, MessageSquare, History, Download, UserPlus,
  BookOpen, StickyNote, Highlighter, Quote, Search as SearchIcon, Sparkles,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { AddProjectItemDialog } from "@/components/library/research/AddProjectItemDialog";
import { useResearchProject } from "@/hooks/library/useResearchProjects";
import { downloadResearchExport, RESEARCH_EXPORT_FORMATS, type ResearchExportFormat } from "@/lib/library/researchExport";
import type { ResearchExportItem } from "@/lib/library/researchExport";
import type { LibraryResearchProjectItemRow } from "@/services/library/researchProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const ITEM_ICONS = { book: BookOpen, note: StickyNote, highlight: Highlighter, reference: Quote, saved_search: SearchIcon, analysis: Sparkles };

function itemTitle(item: LibraryResearchProjectItemRow): string {
  switch (item.item_type) {
    case "book": return item.library_books?.title ?? "";
    case "note": return item.library_notes?.content ?? "";
    case "highlight": return item.library_highlights?.quoted_text ?? "";
    case "saved_search": return item.library_saved_searches?.name ?? item.library_saved_searches?.query ?? "";
    case "analysis": return item.library_research_analyses?.title ?? "";
    case "reference": return item.citation_text ?? "";
    default: return "";
  }
}

export default function LibraryResearchProjectDetail() {
  const { t } = useLanguage();
  const { projectId = "" } = useParams<{ projectId: string }>();
  const {
    project, members, items, comments, versions, canEdit,
    invite, removeMember, addItem, removeItem, addComment, removeComment, snapshot,
  } = useResearchProject(projectId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [commentBody, setCommentBody] = useState("");
  const [exportFormat, setExportFormat] = useState<ResearchExportFormat>("pdf");
  const [snapshotNote, setSnapshotNote] = useState("");

  useDocumentHead({ title: project?.title ?? t("library.researchProjects.title") });

  const handleExport = () => {
    if (!project) return;
    const exportItems: ResearchExportItem[] = items.map((item) => ({
      itemType: item.item_type,
      title: itemTitle(item) || item.item_type,
      content: item.item_type === "reference" ? undefined : itemTitle(item),
      citation: item.citation_text ?? undefined,
      addedAt: item.added_at,
    }));
    downloadResearchExport({ projectTitle: project.title, projectDescription: project.description, items: exportItems }, exportFormat);
  };

  return (
    <Layout>
      <LibraryLayout
        title={project?.title ?? ""}
        breadcrumb={[{ label: t("library.researchProjects.title"), to: "/library/research-projects" }, { label: project?.title ?? "" }]}
        headerActions={
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ResearchExportFormat)}>
              <SelectTrigger className="w-28" aria-label={t("library.researchAssistant.export")}><SelectValue /></SelectTrigger>
              <SelectContent>{RESEARCH_EXPORT_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchAssistant.export")}
            </Button>
          </div>
        }
      >
        <Link to="/library/research-projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("library.researchProjects.title")}
        </Link>

        {project?.description && <p className="mb-4 text-sm text-muted-foreground">{project.description}</p>}

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">{t("library.researchProjects.items")}</TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.members")}</TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.comments")}</TabsTrigger>
            <TabsTrigger value="versions" className="gap-1.5"><History className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.versions")}</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-3">
            {canEdit && <AddProjectItemDialog onAdd={addItem} />}
            {items.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-8 w-8" />} title={t("library.researchProjects.noItems")} className="py-8" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const Icon = ITEM_ICONS[item.item_type];
                  return (
                    <Card key={item.id} className="flex items-start gap-2 p-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{itemTitle(item) || t(`library.researchProjects.itemType.${item.item_type}`)}</p>
                        <Badge variant="outline" className="mt-1 text-xs">{t(`library.researchProjects.itemType.${item.item_type}`)}</Badge>
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => void removeItem(item.id)} aria-label={t("library.reviews.delete")}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-3">
            {canEdit && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.invite")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("library.researchProjects.invite")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t("library.researchProjects.inviteEmailPlaceholder")} aria-label={t("library.researchProjects.inviteEmailPlaceholder")} />
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "editor" | "viewer")}>
                      <SelectTrigger aria-label={t("library.researchProjects.invite")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">{t("library.researchProjects.roleViewer")}</SelectItem>
                        <SelectItem value="editor">{t("library.researchProjects.roleEditor")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { void invite(inviteEmail.trim(), inviteRole); setInviteEmail(""); }} disabled={!inviteEmail.trim()}>
                      {t("library.researchProjects.invite")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.user_id}>
                  <Card className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2">
                      {m.avatar_url && <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />}
                      <span className="text-sm font-medium">{m.display_name ?? t("library.researchProjects.unknownMember")}</span>
                      <Badge variant="secondary" className="text-xs">{t(`library.researchProjects.role${m.role.charAt(0).toUpperCase()}${m.role.slice(1)}`)}</Badge>
                    </div>
                    {canEdit && m.role !== "owner" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeMember(m.user_id)} aria-label={t("library.reviews.delete")}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="comments" className="space-y-3">
            <div className="flex gap-2">
              <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={2} placeholder={t("library.researchProjects.commentPlaceholder")} />
              <Button
                onClick={() => { void addComment(commentBody.trim()); setCommentBody(""); }}
                disabled={!commentBody.trim()}
                className="self-end"
              >
                {t("library.researchProjects.postComment")}
              </Button>
            </div>
            {comments.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t("library.researchProjects.noComments")} className="py-8" />
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id}>
                    <Card className="p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{c.display_name ?? t("library.researchProjects.unknownMember")}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void removeComment(c.id)} aria-label={t("library.reviews.delete")}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="text-sm">{c.body}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="versions" className="space-y-3">
            {canEdit && (
              <div className="flex gap-2">
                <Input value={snapshotNote} onChange={(e) => setSnapshotNote(e.target.value)} placeholder={t("library.researchProjects.snapshotNotePlaceholder")} />
                <Button onClick={() => { void snapshot(snapshotNote.trim() || undefined); setSnapshotNote(""); }}>{t("library.researchProjects.saveVersion")}</Button>
              </div>
            )}
            {versions.length === 0 ? (
              <EmptyState icon={<History className="h-8 w-8" />} title={t("library.researchProjects.noVersions")} className="py-8" />
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Card className="p-3">
                      <p className="text-sm font-medium">{v.note || t("library.researchProjects.unnamedVersion")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </LibraryLayout>
    </Layout>
  );
}
