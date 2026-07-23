import { useState } from "react";
import { Users, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLibraryCheckout } from "@/hooks/library/useLibraryCheckout";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryLicenseType } from "@/lib/types/library-marketplace";

interface LicensePurchaseDialogProps {
  bookId: string;
  bookTitle: string;
  priceVx: number | null;
  priceUsd: number | null;
}

const LICENSE_TYPES: LibraryLicenseType[] = ["individual", "corporate", "educational", "family"];

/** Corporate/educational/family multi-seat licenses — total price is the
 *  book's normal price × seat count (see handleLicense in
 *  library-checkout-session). Seats themselves are invited afterward from
 *  the buyer's "My Licenses" page (useMyLicenses/useLicenseSeats), not here. */
export function LicensePurchaseDialog({ bookId, bookTitle, priceVx, priceUsd }: LicensePurchaseDialogProps) {
  const { t } = useLanguage();
  const { checkout, isProcessing } = useLibraryCheckout();
  const [open, setOpen] = useState(false);
  const [licenseType, setLicenseType] = useState<LibraryLicenseType>("individual");
  const [seatCount, setSeatCount] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState<"vx" | "cash">(priceVx ? "vx" : "cash");

  const totalVx = priceVx != null ? priceVx * seatCount : null;
  const totalUsd = priceUsd != null ? priceUsd * seatCount : null;

  const handleSubmit = async () => {
    const result = await checkout({
      book_id: bookId,
      payment_method: paymentMethod,
      pricing_model: "license",
      license_type: licenseType,
      seat_count: seatCount,
    });
    if (result) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="me-2 h-4 w-4" aria-hidden="true" />
          {t("library.license.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.license.title").replace("{title}", bookTitle)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="license-type">{t("library.license.type")}</Label>
            <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LibraryLicenseType)}>
              <SelectTrigger id="license-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`library.license.type.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="license-seats">{t("library.license.seatCount")}</Label>
            <Input
              id="license-seats"
              type="number"
              min={1}
              max={500}
              value={seatCount}
              onChange={(e) => setSeatCount(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          {totalVx != null && totalUsd != null && (
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "vx" | "cash")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vx" id="license-pay-vx" />
                <Label htmlFor="license-pay-vx" className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{totalVx} VX</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cash" id="license-pay-cash" />
                <Label htmlFor="license-pay-cash">${totalUsd.toFixed(2)}</Label>
              </div>
            </RadioGroup>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void handleSubmit()} disabled={isProcessing}>
            {t("library.license.purchase")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
