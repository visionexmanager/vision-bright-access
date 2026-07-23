import { useState } from "react";
import { Gift, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLibraryCheckout } from "@/hooks/library/useLibraryCheckout";
import { useLanguage } from "@/contexts/LanguageContext";

interface GiftPurchaseDialogProps {
  bookId: string;
  bookTitle: string;
  priceVx: number | null;
  priceUsd: number | null;
}

/** Sets recipient_email/gift_message and calls the same checkout edge
 *  function every other paid purchase uses — the "already owned" guard is
 *  skipped server-side specifically for gifts, so this works even if the
 *  giver already owns the book themselves. */
export function GiftPurchaseDialog({ bookId, bookTitle, priceVx, priceUsd }: GiftPurchaseDialogProps) {
  const { t } = useLanguage();
  const { checkout, isProcessing } = useLibraryCheckout();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"vx" | "cash">(priceVx ? "vx" : "cash");

  const handleSubmit = async () => {
    if (!email.trim()) return;
    const result = await checkout({
      book_id: bookId,
      payment_method: paymentMethod,
      pricing_model: "paid",
      recipient_email: email.trim(),
      gift_message: message.trim() || undefined,
    });
    if (result) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("library.gift.action")}>
          <Gift className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.gift.title").replace("{title}", bookTitle)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="gift-recipient-email">{t("library.gift.recipientEmail")}</Label>
            <Input id="gift-recipient-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
          </div>
          <div>
            <Label htmlFor="gift-message">{t("library.gift.message")}</Label>
            <Textarea id="gift-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} rows={3} />
          </div>
          {priceVx != null && priceUsd != null && (
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "vx" | "cash")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vx" id="gift-pay-vx" />
                <Label htmlFor="gift-pay-vx" className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{priceVx} VX</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cash" id="gift-pay-cash" />
                <Label htmlFor="gift-pay-cash">${priceUsd}</Label>
              </div>
            </RadioGroup>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void handleSubmit()} disabled={isProcessing || !email.trim()}>
            {t("library.gift.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
