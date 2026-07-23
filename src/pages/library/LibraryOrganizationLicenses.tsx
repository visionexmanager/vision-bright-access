import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Loader2, KeySquare, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationLicenses } from "@/hooks/library/useOrganizationLicenses";
import type { OrganizationLicenseType } from "@/services/library/organizationLicenses";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

const LICENSE_TYPES: OrganizationLicenseType[] = ["seat", "concurrent", "subscription", "time_limited", "department", "educational", "corporate"];

export default function LibraryOrganizationLicenses() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.licenses") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <LicensesBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function LicensesBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const orgId = ctx.organization!.id;
  const { licenses, seatUsage, concurrentCount, isLoading, create, deactivate } = useOrganizationLicenses(orgId);
  const [isOpen, setIsOpen] = useState(false);
  const [licenseType, setLicenseType] = useState<OrganizationLicenseType>("seat");
  const [seatCount, setSeatCount] = useState("50");
  const [concurrentLimit, setConcurrentLimit] = useState("20");

  const usageByLicense = new Map(seatUsage.map((u) => [u.license_id, u]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.licenses.concurrentNow").replace("{count}", String(concurrentCount))}
        </h2>
        {ctx.isAdmin && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.licenses.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.licenses.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("library.enterprise.licenses.type")}</Label>
                  <Select value={licenseType} onValueChange={(v) => setLicenseType(v as OrganizationLicenseType)}>
                    <SelectTrigger aria-label={t("library.enterprise.licenses.type")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LICENSE_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`library.enterprise.licenseType.${type}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {licenseType !== "concurrent" && (
                  <div>
                    <Label htmlFor="seat-count">{t("library.enterprise.licenses.seatCount")}</Label>
                    <Input id="seat-count" type="number" min={1} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
                  </div>
                )}
                {licenseType === "concurrent" && (
                  <div>
                    <Label htmlFor="concurrent-limit">{t("library.enterprise.licenses.concurrentLimit")}</Label>
                    <Input id="concurrent-limit" type="number" min={1} value={concurrentLimit} onChange={(e) => setConcurrentLimit(e.target.value)} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    await create({
                      licenseType,
                      seatCount: licenseType !== "concurrent" ? Number(seatCount) || undefined : undefined,
                      concurrentLimit: licenseType === "concurrent" ? Number(concurrentLimit) || undefined : undefined,
                    });
                    setIsOpen(false);
                  }}
                >
                  {t("library.enterprise.licenses.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : licenses.length === 0 ? (
        <EmptyState icon={<KeySquare className="h-8 w-8" />} title={t("library.enterprise.licenses.empty")} className="py-12" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {licenses.map((l) => {
            const usage = usageByLicense.get(l.id);
            return (
              <Card key={l.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{t(`library.enterprise.licenseType.${l.license_type}`)}</Badge>
                  {!l.is_active && <Badge variant="outline" className="text-xs">{t("library.enterprise.licenses.inactive")}</Badge>}
                </div>
                {l.seat_count != null && (
                  <div>
                    <Progress value={usage ? (Number(usage.seats_used) / l.seat_count) * 100 : 0} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">{t("library.enterprise.licenses.seatsUsed").replace("{used}", String(usage?.seats_used ?? 0)).replace("{total}", String(l.seat_count))}</p>
                  </div>
                )}
                {l.concurrent_limit != null && <p className="text-xs text-muted-foreground">{t("library.enterprise.licenses.limitOf").replace("{count}", String(l.concurrent_limit))}</p>}
                {l.expires_at && <p className="text-xs text-muted-foreground">{t("library.enterprise.licenses.expires").replace("{date}", new Date(l.expires_at).toLocaleDateString())}</p>}
                {ctx.isAdmin && l.is_active && (
                  <Button size="sm" variant="outline" onClick={() => void deactivate(l.id)}>{t("library.enterprise.licenses.deactivate")}</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
