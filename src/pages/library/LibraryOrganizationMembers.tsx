import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Upload, Download, X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { exportMembersToCsv, parseMembersCsv, type OrganizationMemberRole } from "@/services/library/organizations";
import { ORGANIZATION_ROLES } from "@/services/library/organizationPermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

export default function LibraryOrganizationMembers() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.members") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <MembersBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function MembersBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const { organization, members, isAdmin, invite, bulkInvite, updateMember, removeMember } = ctx;
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationMemberRole>("guest");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const rows = parseMembersCsv(text);
      await bulkInvite(rows);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
    const csv = exportMembersToCsv(members);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${organization?.slug ?? "organization"}-members.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("library.enterprise.members.rosterCount").replace("{count}", String(members.length))}</h2>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.members.exportCsv")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
              {t("library.enterprise.members.importCsv")}
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleFileImport(e)} aria-label={t("library.enterprise.members.importCsv")} />
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.members.invite")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.enterprise.members.invite")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="invite-email">{t("library.enterprise.members.email")}</Label>
                    <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("library.enterprise.members.role")}</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrganizationMemberRole)}>
                      <SelectTrigger aria-label={t("library.enterprise.members.role")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_ROLES.map((role) => <SelectItem key={role} value={role}>{t(`library.enterprise.role.${role}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!inviteEmail.trim()}
                    onClick={async () => { const ok = await invite(inviteEmail.trim(), inviteRole); if (ok) { setIsInviteOpen(false); setInviteEmail(""); } }}
                  >
                    {t("library.enterprise.members.invite")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title={t("library.enterprise.members.empty")} className="py-12" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("library.enterprise.members.name")}</TableHead>
                <TableHead>{t("library.enterprise.members.role")}</TableHead>
                <TableHead>{t("library.enterprise.members.status")}</TableHead>
                {isAdmin && <TableHead className="text-end">{t("library.enterprise.members.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id ?? m.invited_email}>
                  <TableCell>{m.display_name ?? m.invited_email ?? "—"}</TableCell>
                  <TableCell>
                    {isAdmin && m.user_id ? (
                      <Select value={m.role} onValueChange={(v) => void updateMember(m.user_id!, { role: v as OrganizationMemberRole })}>
                        <SelectTrigger className="h-8 w-36" aria-label={t("library.enterprise.members.role")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ORGANIZATION_ROLES.map((role) => <SelectItem key={role} value={role}>{t(`library.enterprise.role.${role}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{m.custom_role_label || t(`library.enterprise.role.${m.role}`)}</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={m.status === "active" ? "secondary" : "outline"} className="text-xs">{t(`library.enterprise.memberStatus.${m.status}`)}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="text-end">
                      {m.user_id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void removeMember(m.user_id!)} aria-label={t("library.reviews.delete")}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
