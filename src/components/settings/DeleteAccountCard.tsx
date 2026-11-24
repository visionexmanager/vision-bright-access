import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  "not_using", "privacy", "too_expensive", "missing_features",
  "found_alternative", "bad_experience", "other",
] as const;

type Reason = typeof REASONS[number];

/** Settings → "Delete my account". Talks only to trial-billing (account_deletion_* actions). */
export function DeleteAccountCard() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [purgeAfter, setPurgeAfter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const call = useCallback(
    (body: Record<string, unknown>) => supabase.functions.invoke("trial-billing", { body }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    call({ action: "account_deletion_status" }).then(({ data }) => {
      if (alive) setPurgeAfter(data?.pending ? (data.purge_after as string) : null);
    });
    return () => { alive = false; };
  }, [user, call]);

  if (!user) return null;

  const dateText = (iso: string) => {
    try { return new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(iso)); }
    catch { return iso.slice(0, 10); }
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await call({
      action: "account_deletion_request", reason_code: reason, reason_text: details, confirm_email: email,
    });
    setBusy(false);
    if (error || !data || data.error) {
      const code = data?.error as string | undefined;
      const text = code === "confirm_mismatch" ? t("settings.delete.errMismatch")
        : code === "staff_account" ? t("settings.delete.errStaff")
        : t("settings.delete.errFailed");
      setMessage({ kind: "error", text });
      return;
    }
    setPurgeAfter(data.purge_after as string);
    setOpen(false);
    setMessage({ kind: "ok", text: t("settings.delete.done") });
  };

  const cancel = async () => {
    setBusy(true);
    const { data, error } = await call({ action: "account_deletion_cancel" });
    setBusy(false);
    if (error || !data?.cancelled) {
      setMessage({ kind: "error", text: t("settings.delete.errFailed") });
      return;
    }
    setPurgeAfter(null);
    setReason(""); setDetails(""); setEmail("");
    setMessage({ kind: "ok", text: t("settings.delete.cancelled") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
          {t("settings.delete.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {purgeAfter ? (
          <div className="space-y-3">
            <h3 className="font-medium">{t("settings.delete.pendingTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("settings.delete.pendingBody").replace("{date}", dateText(purgeAfter))}
            </p>
            <Button onClick={cancel} disabled={busy}>{t("settings.delete.cancelBtn")}</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("settings.delete.intro")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.delete.note")}</p>
            <Button variant="destructive" onClick={() => { setMessage(null); setOpen(true); }}>
              {t("settings.delete.title")}
            </Button>
          </>
        )}

        {/* Announced to screen readers without moving focus. */}
        <div aria-live="polite" role="status">
          {message && (
            <p className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {message.text}
            </p>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.delete.title")}</DialogTitle>
            <DialogDescription>{t("settings.delete.intro")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("settings.delete.reasonLabel")}</legend>
              <RadioGroup value={reason} onValueChange={(v) => setReason(v as Reason)} className="space-y-2">
                {REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <RadioGroupItem value={r} id={`del-reason-${r}`} />
                    <Label htmlFor={`del-reason-${r}`} className="cursor-pointer">
                      {t(`settings.delete.reason.${r}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="space-y-1">
              <Label htmlFor="del-details">{t("settings.delete.detailsLabel")}</Label>
              <Textarea id="del-details" value={details} maxLength={1000}
                onChange={(e) => setDetails(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="del-email">{t("settings.delete.confirmLabel")}</Label>
              <Input id="del-email" type="email" autoComplete="off" value={email}
                onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>

            <div aria-live="assertive" role="alert">
              {message?.kind === "error" && <p className="text-sm text-destructive">{message.text}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t("settings.delete.keep")}
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy || !reason || !email.trim()}>
              {t("settings.delete.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
