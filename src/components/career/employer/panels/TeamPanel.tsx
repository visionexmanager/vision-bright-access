import { useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_TEAM, ROLE_PERMISSIONS } from "../mock/mockTeam";
import type { TeamMember, TeamRole } from "../types";

const ROLES: TeamRole[] = ["admin", "hr", "recruiter", "viewer"];
const ROLE_STYLES: Record<TeamRole, string> = {
  admin: "bg-primary/10 text-primary",
  hr: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  recruiter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  viewer: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7"];

export function TeamPanel() {
  const { t } = useLanguage();
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("recruiter");

  const addMember = () => {
    if (!name.trim() || !email.trim()) return;
    setTeam((prev) => [
      ...prev,
      { id: `team-${Date.now()}`, name: name.trim(), email: email.trim(), role, avatarColor: AVATAR_COLORS[prev.length % AVATAR_COLORS.length], joinedDate: new Date().toISOString().slice(0, 10) },
    ]);
    setName(""); setEmail(""); setRole("recruiter");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("employerDash.nav.team")}</h1>
          <p className="text-sm text-muted-foreground">{t("employerDash.team.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("employerDash.team.addMember")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {team.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center gap-3">
              <CompanyAvatar name={member.name} color={member.avatarColor} size="sm" />
              <div>
                <p className="text-sm font-bold">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${ROLE_STYLES[member.role]}`}>{t(`employerDash.team.role.${member.role}`)}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-bold">{t("employerDash.team.permissionsTitle")}</p>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employerDash.team.role.label")}</TableHead>
                <TableHead>{t("employerDash.team.permission.postJobs")}</TableHead>
                <TableHead>{t("employerDash.team.permission.viewCandidates")}</TableHead>
                <TableHead>{t("employerDash.team.permission.manageTeam")}</TableHead>
                <TableHead>{t("employerDash.team.permission.viewAnalytics")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map((r) => {
                const perms = ROLE_PERMISSIONS[r];
                return (
                  <TableRow key={r}>
                    <TableCell className="font-medium capitalize">{t(`employerDash.team.role.${r}`)}</TableCell>
                    {(["postJobs", "viewCandidates", "manageTeam", "viewAnalytics"] as const).map((key) => (
                      <TableCell key={key}>
                        {perms[key] ? <Check className="h-4 w-4 text-emerald-500" aria-label={t("employerDash.team.allowed")} /> : <X className="h-4 w-4 text-muted-foreground" aria-label={t("employerDash.team.notAllowed")} />}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("employerDash.team.addMember")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="tm-name">{t("employerDash.team.name")}</Label>
              <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tm-email">{t("employerDash.team.email")}</Label>
              <Input id="tm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>{t("employerDash.team.role.label")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`employerDash.team.role.${r}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("careerDash.profile.cancel")}</Button>
            <Button onClick={addMember}>{t("employerDash.team.invite")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
