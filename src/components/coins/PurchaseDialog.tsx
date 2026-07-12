import { useEffect, useState } from "react";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCreateVxCoinOrder } from "@/hooks/useVxCoinOrders";
import { supabase } from "@/integrations/supabase/client";
import type { VxPaymentMethod } from "@/services/vxCoins";

const PAYMENT_METHODS: { value: VxPaymentMethod; labelKey: string }[] = [
  { value: "wishmoney", labelKey: "coins.method.wishmoney" },
  { value: "omt", labelKey: "coins.method.omt" },
  { value: "paypal", labelKey: "coins.method.paypal" },
];

const SETTINGS_KEY: Record<VxPaymentMethod, string> = {
  wishmoney: "vx_payment_wishmoney",
  omt: "vx_payment_omt",
  paypal: "vx_payment_paypal",
};

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coins: number;
  total: number;
}

export function PurchaseDialog({ open, onOpenChange, coins, total }: PurchaseDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { submitProof, isUploading, submitOrder, isSubmitting } = useCreateVxCoinOrder();

  const [step, setStep] = useState<"method" | "form" | "done">("method");
  const [method, setMethod] = useState<VxPaymentMethod>("wishmoney");
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [referenceCode, setReferenceCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("method");
    setMethod("wishmoney");
    setReferenceCode("");
    setProofFile(null);
    (supabase.from("site_settings") as any)
      .select("key, value")
      .in("key", Object.values(SETTINGS_KEY))
      .then(({ data }: { data: { key: string; value: unknown }[] | null }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((s) => { map[s.key] = typeof s.value === "string" ? s.value : ""; });
        setInstructions(map);
      });
  }, [open]);

  const submit = async () => {
    if (!user) return;
    if (!referenceCode.trim()) {
      toast.error(t("coins.purchase.referenceRequired"));
      return;
    }
    try {
      let proofUrl: string | null = null;
      if (proofFile) proofUrl = await submitProof(proofFile);
      await submitOrder({ coins, paymentMethod: method, referenceCode: referenceCode.trim(), proofUrl });
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("coins.purchase.error"));
    }
  };

  const busy = isUploading || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === "method" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("coins.purchase.selectMethod")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {coins.toLocaleString()} VX · ${total}
            </p>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as VxPaymentMethod)} className="gap-3">
              {PAYMENT_METHODS.map((m) => (
                <div key={m.value} className="flex items-center gap-2 rounded-lg border p-3">
                  <RadioGroupItem value={m.value} id={`method-${m.value}`} />
                  <Label htmlFor={`method-${m.value}`} className="flex-1 cursor-pointer font-medium">{t(m.labelKey)}</Label>
                </div>
              ))}
            </RadioGroup>
            <DialogFooter>
              <Button onClick={() => setStep("form")} className="w-full">{t("coins.purchase.continue")}</Button>
            </DialogFooter>
          </>
        )}

        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>{t(PAYMENT_METHODS.find((m) => m.value === method)!.labelKey)}</DialogTitle>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-line">
              {instructions[SETTINGS_KEY[method]] || t("coins.purchase.noInstructions")}
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="reference-code">{t("coins.purchase.referenceCode")}</Label>
                <Input id="reference-code" value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="proof-file">{t("coins.purchase.proofOptional")}</Label>
                <Input
                  id="proof-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep("method")} disabled={busy}>{t("coins.purchase.back")}</Button>
              <Button onClick={submit} disabled={busy || !referenceCode.trim()}>
                {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="me-2 h-4 w-4" aria-hidden="true" />}
                {busy ? t("coins.purchase.submitting") : t("coins.purchase.submit")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                {t("coins.purchase.submittedTitle")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("coins.purchase.submittedDesc")}</p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">{t("coins.purchase.close")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
