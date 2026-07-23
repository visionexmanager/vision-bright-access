import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCollaborators } from "@/hooks/library/useCollaborators";
import { InviteCollaboratorDialog } from "@/components/library/studio/collaboration/InviteCollaboratorDialog";
import type { LibraryCollaboratorRole } from "@/lib/types/library-studio";

const ROLES: LibraryCollaboratorRole[] = ["owner", "editor", "proofreader", "translator", "designer", "reviewer"];

interface CollaboratorsPanelProps {
  bookId: string;
}

export function CollaboratorsPanel({ bookId }: CollaboratorsPanelProps) {
  const { t } = useLanguage();
  const { collaborators, isLoading, invite, changeRole, revoke } = useCollaborators(bookId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("library.studio.collaboration.title")}</h3>
        <InviteCollaboratorDialog onInvite={invite} />
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : collaborators.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.studio.collaboration.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {collaborators.map((collaborator) => (
            <li key={collaborator.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{collaborator.displayName ?? collaborator.invited_email ?? t("library.studio.collaboration.pendingUser")}</p>
                <Badge variant={collaborator.status === "active" ? "default" : "outline"} className="mt-0.5 text-[10px]">
                  {t(`library.studio.collaboration.status.${collaborator.status}`)}
                </Badge>
              </div>
              <Select value={collaborator.role} onValueChange={(v) => void changeRole(collaborator.id, v as LibraryCollaboratorRole)}>
                <SelectTrigger className="h-8 w-32 text-xs" aria-label={t("library.studio.collaboration.roleLabel")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`library.studio.collaboration.role.${r}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => void revoke(collaborator.id)} aria-label={t("library.studio.collaboration.revoke")}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
