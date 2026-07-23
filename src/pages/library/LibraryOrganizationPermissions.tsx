import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationPermissions } from "@/hooks/library/useOrganizationPermissions";
import { ORGANIZATION_PERMISSIONS, ORGANIZATION_ROLES } from "@/services/library/organizationPermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

export default function LibraryOrganizationPermissions() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.permissions") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <PermissionsBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function PermissionsBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const orgId = ctx.organization!.id;
  const { isLoading, has, toggle } = useOrganizationPermissions(orgId);

  if (!ctx.isAdmin) {
    return <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title={t("library.enterprise.permissions.adminOnly")} className="py-12" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("library.enterprise.permissions.description")}</p>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("library.enterprise.permissions.role")}</TableHead>
                {ORGANIZATION_PERMISSIONS.map((perm) => <TableHead key={perm} className="text-center">{t(`library.enterprise.permission.${perm}`)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORGANIZATION_ROLES.map((role) => (
                <TableRow key={role}>
                  <TableCell className="font-medium">{t(`library.enterprise.role.${role}`)}</TableCell>
                  {ORGANIZATION_PERMISSIONS.map((perm) => {
                    const granted = has(role, perm);
                    return (
                      <TableCell key={perm} className="text-center">
                        <Checkbox
                          checked={granted}
                          onCheckedChange={() => void toggle(role, perm, granted)}
                          disabled={role === "owner"}
                          aria-label={`${t(`library.enterprise.role.${role}`)} — ${t(`library.enterprise.permission.${perm}`)}`}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
