import { useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, Smartphone, Monitor, ScrollText, Loader2, X, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/library/EmptyState";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationAuditLog, useOrganizationRequire2fa, useMyMfa } from "@/hooks/library/useOrganizationSecurity";
import { useOrganizationSessions } from "@/hooks/library/useOrganizationLicenses";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

export default function LibraryOrganizationSecurity() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();
  useDocumentHead({ title: t("library.enterprise.nav.security") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <SecurityBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function MfaSection() {
  const { t } = useLanguage();
  const { factors, isLoading, enrollment, startEnroll, confirmEnroll, remove, cancelEnroll } = useMyMfa();
  const [code, setCode] = useState("");

  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.security.twoFactor")}</h2>
      <p className="text-sm text-muted-foreground">{t("library.enterprise.security.twoFactorDescription")}</p>

      {factors.length > 0 && (
        <ul className="space-y-1.5">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span>{t("library.enterprise.security.authenticatorApp")}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{f.status}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void remove(f.id)} aria-label={t("library.reviews.delete")}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {enrollment ? (
        <div className="space-y-2 rounded-md border p-3">
          <img src={enrollment.qrCode} alt={t("library.enterprise.security.qrCodeAlt")} className="h-40 w-40" />
          <p className="text-xs text-muted-foreground">{t("library.enterprise.security.secretKey")}: <code>{enrollment.secret}</code></p>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("library.enterprise.security.enterCode")} aria-label={t("library.enterprise.security.enterCode")} maxLength={6} />
            <Button onClick={() => void confirmEnroll(code)} disabled={code.length !== 6}>{t("library.enterprise.security.verify")}</Button>
            <Button variant="ghost" onClick={cancelEnroll}>{t("library.enterprise.security.cancel")}</Button>
          </div>
        </div>
      ) : (
        factors.length === 0 && (
          <Button size="sm" variant="outline" disabled={isLoading} onClick={() => void startEnroll()} className="gap-1.5">
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("library.enterprise.security.enable2fa")}
          </Button>
        )
      )}
    </Card>
  );
}

function SecurityBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const organization = ctx.organization!;
  const { sessions, isLoading: isLoadingSessions, revoke } = useOrganizationSessions(organization.id);
  const { entries, isLoading: isLoadingAudit } = useOrganizationAuditLog(organization.id);
  const { toggle: toggleRequire2fa } = useOrganizationRequire2fa(organization.id, organization.slug);

  return (
    <div className="space-y-6">
      <MfaSection />

      {ctx.isAdmin && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <Label htmlFor="require-2fa-switch" className="text-sm font-medium">{t("library.enterprise.security.require2fa")}</Label>
            <p className="text-xs text-muted-foreground">{t("library.enterprise.security.require2faDescription")}</p>
          </div>
          <Switch id="require-2fa-switch" checked={organization.require_2fa} onCheckedChange={toggleRequire2fa} />
        </Card>
      )}

      <Card className="space-y-2 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.security.sso")}</h2>
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p>{t("library.enterprise.security.ssoDisclosure")}</p>
        </div>
      </Card>

      {ctx.isAdmin && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Monitor className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.security.activeSessions")}</h2>
          {isLoadingSessions ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("library.enterprise.security.noSessions")}</p>
          ) : (
            <ul className="space-y-1.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Card className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{s.display_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{t("library.enterprise.security.lastSeen").replace("{time}", new Date(s.last_seen_at).toLocaleString())}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void revoke(s.id)}>{t("library.enterprise.security.endSession")}</Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {ctx.isAdmin && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><ScrollText className="h-4 w-4" aria-hidden="true" /> {t("library.enterprise.security.auditLog")}</h2>
          {isLoadingAudit ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
          ) : entries.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-8 w-8" />} title={t("library.enterprise.security.noAuditEntries")} className="py-8" />
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e) => (
                <li key={e.id}>
                  <Card className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.action.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.actor_display_name ?? t("library.enterprise.security.unknownActor")}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
