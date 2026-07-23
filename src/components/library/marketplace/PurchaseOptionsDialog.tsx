import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAlternatePaymentCheckout, type PaymentRail } from "@/hooks/library/useAlternatePaymentCheckout";
import { useLanguage } from "@/contexts/LanguageContext";

interface PurchaseOptionsDialogProps {
  bookId: string;
  priceUsd: number;
}

/**
 * "More payment options" — card (Stripe)/PayPal/crypto, alongside the
 * primary VX purchase button (which stays wired to usePurchaseBook,
 * unchanged). Only rendered when the book has a USD price at all; VX-only
 * books have nothing to show here.
 */
export function PurchaseOptionsDialog({ bookId, priceUsd }: PurchaseOptionsDialogProps) {
  const { t } = useLanguage();
  const { checkout, isProcessing } = useAlternatePaymentCheckout();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState<PaymentRail>("cash");

  const handleSubmit = async () => {
    const result = await checkout(rail, { book_id: bookId, pricing_model: "paid" });
    if (result) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CreditCard className="me-2 h-4 w-4" aria-hidden="true" />
          {t("library.purchase.otherMethods")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.purchase.choosePaymentMethod")}</DialogTitle>
        </DialogHeader>
        <RadioGroup value={rail} onValueChange={(v) => setRail(v as PaymentRail)} className="gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="cash" id="pay-rail-card" />
            <Label htmlFor="pay-rail-card">{t("library.purchase.card")} — ${priceUsd}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="paypal" id="pay-rail-paypal" />
            <Label htmlFor="pay-rail-paypal">PayPal — ${priceUsd}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="crypto" id="pay-rail-crypto" />
            <Label htmlFor="pay-rail-crypto">{t("library.purchase.crypto")} — ${priceUsd}</Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button onClick={() => void handleSubmit()} disabled={isProcessing}>
            {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("library.purchase.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
