import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, X, ClipboardList, Loader2, Check, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationAssignments, useAssignmentCompletions } from "@/hooks/library/useOrganizationAssignments";
import { useOrganizationGroups } from "@/hooks/library/useOrganizationGroups";
import type { OrganizationAssignmentType } from "@/services/library/organizationAssignments";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

const ASSIGNMENT_TYPES: OrganizationAssignmentType[] = ["book", "audiobook", "course", "reading_list", "quiz", "assignment"];

export default function LibraryOrganizationAssignments() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.assignments") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <AssignmentsBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function AssignmentCard({ orgId, assignmentId, isAdmin }: { orgId: string; assignmentId: string; isAdmin: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { completions } = useAssignmentCompletions(assignmentId);
  const { complete, issueCertificate } = useOrganizationAssignments(orgId);
  const myCompletion = completions.find((c) => c.user_id === user?.id);

  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-muted-foreground">{t("library.enterprise.assignments.completions").replace("{count}", String(completions.length))}</p>
      {!isAdmin && !myCompletion && (
        <Button size="sm" variant="outline" className="h-6 gap-1 text-xs" onClick={() => void complete(assignmentId)}>
          <Check className="h-3 w-3" aria-hidden="true" /> {t("library.enterprise.assignments.markComplete")}
        </Button>
      )}
      {myCompletion && (
        <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => void issueCertificate(assignmentId)}>
          <Award className="h-3 w-3" aria-hidden="true" /> {t("library.enterprise.assignments.getCertificate")}
        </Button>
      )}
    </div>
  );
}

function AssignmentsBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const orgId = ctx.organization!.id;
  const { assignments, myAssignments, isLoading, create, remove } = useOrganizationAssignments(orgId);
  const { groups } = useOrganizationGroups(orgId);
  const [isOpen, setIsOpen] = useState(false);
  const [assignmentType, setAssignmentType] = useState<OrganizationAssignmentType>("book");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");

  const list = ctx.isAdmin ? assignments : myAssignments;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("library.enterprise.assignments.title")}</h2>
        {ctx.isAdmin && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.assignments.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.assignments.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("library.enterprise.assignments.type")}</Label>
                  <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as OrganizationAssignmentType)}>
                    <SelectTrigger aria-label={t("library.enterprise.assignments.type")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`library.enterprise.assignmentType.${type}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assignment-title">{t("library.enterprise.assignments.titleLabel")}</Label>
                  <Input id="assignment-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="assignment-desc">{t("library.enterprise.assignments.descriptionLabel")}</Label>
                  <Textarea id="assignment-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>{t("library.enterprise.assignments.assignToGroup")}</Label>
                  <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                    <SelectTrigger aria-label={t("library.enterprise.assignments.assignToGroup")}><SelectValue placeholder={t("library.enterprise.assignments.assignToGroup")} /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="due-date">{t("library.enterprise.assignments.dueDate")}</Label>
                  <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!title.trim() || !targetGroupId}
                  onClick={async () => {
                    const a = await create({ assignmentType, title: title.trim(), description: description.trim() || undefined, assignedToGroupId: targetGroupId, dueDate: dueDate || undefined });
                    if (a) { setIsOpen(false); setTitle(""); setDescription(""); setTargetGroupId(""); setDueDate(""); }
                  }}
                >
                  {t("library.enterprise.assignments.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("library.enterprise.assignments.empty")} className="py-12" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <Card key={a.id} className="space-y-1.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{t(`library.enterprise.assignmentType.${a.assignment_type}`)}</Badge>
                </div>
                {ctx.isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void remove(a.id)} aria-label={t("library.reviews.delete")}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
              {a.due_date && <p className="text-xs text-muted-foreground">{t("library.enterprise.assignments.due").replace("{date}", new Date(a.due_date).toLocaleDateString())}</p>}
              <AssignmentCard orgId={orgId} assignmentId={a.id} isAdmin={ctx.isAdmin} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
