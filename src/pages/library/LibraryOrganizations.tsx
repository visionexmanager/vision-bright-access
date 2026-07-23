import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { useOrganizations } from "@/hooks/library/useOrganizations";
import type { OrganizationType } from "@/services/library/organizations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const ORG_TYPES: OrganizationType[] = [
  "school", "university", "training_center", "company", "government",
  "ngo", "public_library", "private_library", "research_center", "medical_institution",
];

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

export default function LibraryOrganizations() {
  const { t } = useLanguage();
  const { organizations, isLoading, create } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrganizationType>("company");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useDocumentHead({ title: t("library.enterprise.title") });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    const org = await create({ name: name.trim(), slug: slugify(name), orgType, description: description.trim() || undefined });
    setIsCreating(false);
    if (org) {
      setIsOpen(false);
      setName("");
      setDescription("");
    }
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.enterprise.title")}
        breadcrumb={[{ label: t("library.enterprise.title") }]}
        headerActions={
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="org-name">{t("library.enterprise.nameLabel")}</Label>
                  <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>{t("library.enterprise.typeLabel")}</Label>
                  <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationType)}>
                    <SelectTrigger aria-label={t("library.enterprise.typeLabel")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORG_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`library.enterprise.orgType.${type}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="org-desc">{t("library.enterprise.descriptionLabel")}</Label>
                  <Textarea id="org-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!name.trim() || isCreating} onClick={() => void handleCreate()} className="gap-1.5">
                  {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {t("library.enterprise.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>
        ) : organizations.length === 0 ? (
          <EmptyState icon={<Building2 className="h-10 w-10" />} title={t("library.enterprise.empty")} description={t("library.enterprise.emptyDescription")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Link key={org.id} to={`/library/organizations/${org.slug}`}>
                <Card className="flex h-full flex-col gap-2 p-4 hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 className="line-clamp-1 font-semibold">{org.name}</h2>
                  </div>
                  <Badge variant="secondary" className="w-fit text-xs">{t(`library.enterprise.orgType.${org.org_type}`)}</Badge>
                  {org.description && <p className="line-clamp-2 text-sm text-muted-foreground">{org.description}</p>}
                  <p className="mt-auto text-xs text-muted-foreground">{t("library.enterprise.memberCount").replace("{count}", String(org.member_count))}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
