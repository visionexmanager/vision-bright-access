import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, X, Users2, Loader2 } from "lucide-react";
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
import { useOrganizationGroups, useOrganizationGroupMembers } from "@/hooks/library/useOrganizationGroups";
import type { OrganizationGroupType } from "@/services/library/organizationGroups";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

const GROUP_TYPES: OrganizationGroupType[] = ["department", "class", "team", "project", "research_group", "book_club", "learning_group"];

export default function LibraryOrganizationGroups() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.groups") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <GroupsBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function GroupCard({ groupId }: { groupId: string }) {
  const { t } = useLanguage();
  const { members } = useOrganizationGroupMembers(groupId);
  return (
    <p className="text-xs text-muted-foreground">{t("library.enterprise.groups.memberCount").replace("{count}", String(members.length))}</p>
  );
}

function GroupsBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const orgId = ctx.organization!.id;
  const { groups, isLoading, create, remove } = useOrganizationGroups(orgId);
  const [isOpen, setIsOpen] = useState(false);
  const [groupType, setGroupType] = useState<OrganizationGroupType>("department");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("library.enterprise.groups.title")}</h2>
        {ctx.isAdmin && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.groups.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.groups.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("library.enterprise.groups.type")}</Label>
                  <Select value={groupType} onValueChange={(v) => setGroupType(v as OrganizationGroupType)}>
                    <SelectTrigger aria-label={t("library.enterprise.groups.type")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GROUP_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`library.enterprise.groupType.${type}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="group-name">{t("library.enterprise.groups.name")}</Label>
                  <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="group-desc">{t("library.enterprise.groups.description")}</Label>
                  <Textarea id="group-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!name.trim()}
                  onClick={async () => { const g = await create({ groupType, name: name.trim(), description: description.trim() || undefined }); if (g) { setIsOpen(false); setName(""); setDescription(""); } }}
                >
                  {t("library.enterprise.groups.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon={<Users2 className="h-8 w-8" />} title={t("library.enterprise.groups.empty")} className="py-12" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="space-y-1.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{t(`library.enterprise.groupType.${g.group_type}`)}</Badge>
                </div>
                {ctx.isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void remove(g.id)} aria-label={t("library.reviews.delete")}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
              <GroupCard groupId={g.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
