import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryCollaboratorRole } from "@/lib/types/library-studio";

const ROLES: LibraryCollaboratorRole[] = ["editor", "proofreader", "translator", "designer", "reviewer"];

interface InviteCollaboratorDialogProps {
  onInvite: (email: string, role: LibraryCollaboratorRole) => Promise<void>;
}

export function InviteCollaboratorDialog({ onInvite }: InviteCollaboratorDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LibraryCollaboratorRole>("editor");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await onInvite(email, role);
      setEmail("");
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("library.studio.collaboration.invite")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.studio.collaboration.inviteTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="invite-email">{t("library.studio.collaboration.emailLabel")}</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>{t("library.studio.collaboration.roleLabel")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as LibraryCollaboratorRole)}>
              <SelectTrigger aria-label={t("library.studio.collaboration.roleLabel")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`library.studio.collaboration.role.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void handleInvite()} disabled={isSubmitting || !email.trim()}>
            {t("library.studio.collaboration.sendInvite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
