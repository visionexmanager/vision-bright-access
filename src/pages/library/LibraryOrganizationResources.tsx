import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, X, FileText, Lock, Download, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationResources } from "@/hooks/library/useOrganizationResources";
import type { OrganizationResourceType } from "@/services/library/organizationResources";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

const RESOURCE_TYPES: OrganizationResourceType[] = [
  "collection", "internal_document", "training_manual", "policy", "employee_handbook", "course_library", "confidential_resource",
];

export default function LibraryOrganizationResources() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.resources") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <ResourcesBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function ResourcesBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const orgId = ctx.organization!.id;
  const [filterType, setFilterType] = useState<OrganizationResourceType | "all">("all");
  const { resources, isLoading, isUploading, create, remove, download } = useOrganizationResources(orgId, filterType === "all" ? undefined : filterType);
  const [isOpen, setIsOpen] = useState(false);
  const [resourceType, setResourceType] = useState<OrganizationResourceType>("internal_document");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleCreate = async () => {
    const resource = await create({ resourceType, title: title.trim(), description: description.trim() || undefined, isConfidential }, file ?? undefined);
    if (resource) {
      setIsOpen(false);
      setTitle(""); setDescription(""); setIsConfidential(false); setFile(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={filterType} onValueChange={(v) => setFilterType(v as OrganizationResourceType | "all")}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">{t("library.enterprise.resources.all")}</TabsTrigger>
          {RESOURCE_TYPES.map((type) => <TabsTrigger key={type} value={type}>{t(`library.enterprise.resourceType.${type}`)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="flex justify-end">
        {ctx.isAdmin && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.resources.add")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.resources.add")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("library.enterprise.resources.type")}</Label>
                  <Select value={resourceType} onValueChange={(v) => setResourceType(v as OrganizationResourceType)}>
                    <SelectTrigger aria-label={t("library.enterprise.resources.type")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`library.enterprise.resourceType.${type}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="resource-title">{t("library.enterprise.resources.titleLabel")}</Label>
                  <Input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="resource-desc">{t("library.enterprise.resources.descriptionLabel")}</Label>
                  <Textarea id="resource-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="resource-file">{t("library.enterprise.resources.file")}</Label>
                  <Input id="resource-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="resource-confidential" checked={isConfidential} onCheckedChange={setIsConfidential} />
                  <Label htmlFor="resource-confidential">{t("library.enterprise.resources.confidential")}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!title.trim() || isUploading} onClick={() => void handleCreate()} className="gap-1.5">
                  {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {t("library.enterprise.resources.add")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : resources.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title={t("library.enterprise.resources.empty")} className="py-12" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Card key={r.id} className="space-y-1.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {r.is_confidential && <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
                  <p className="font-medium">{r.title}</p>
                </div>
                {ctx.isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void remove(r.id)} aria-label={t("library.reviews.delete")}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <Badge variant="outline" className="text-xs">{t(`library.enterprise.resourceType.${r.resource_type}`)}</Badge>
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              {r.storage_path && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void download(r.storage_path!)}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.resources.download")}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
