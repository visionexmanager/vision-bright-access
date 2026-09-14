import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Coins, Package, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRICING_PATH } from "@/lib/billing/plans";

interface UpgradeDialogProps {
  open:      boolean;
  onClose:   () => void;
  tab?:      "plans" | "credits";
}

export function UpgradeDialog({ open, onClose, tab = "plans" }: UpgradeDialogProps) {
  const { t }                     = useLanguage();
  const [activeTab, setActiveTab] = useState(tab);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Get More Credits</DialogTitle>
          <DialogDescription>
            Choose a subscription plan for monthly VX credits, or buy one-time packs.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "plans" | "credits")}>
          <TabsList className="mb-4">
            <TabsTrigger value="plans" className="gap-1.5">
              <Package className="size-3.5" /> Subscription Plans
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5">
              <Coins className="size-3.5" /> Buy VX Credits
            </TabsTrigger>
          </TabsList>

          {/* Plans tab — a plan is chosen on the plans page and paid through
              the owner on WhatsApp. Nothing in this dialog activates one: the
              button that used to granted any plan without a payment. */}
          <TabsContent value="plans">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-10 text-center">
              <div className="rounded-full bg-primary/15 p-3">
                <Package className="size-6 text-primary" aria-hidden="true" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{t("planCheckout.howItWorks")}</p>
              <Button asChild onClick={onClose}>
                <Link to={PRICING_PATH}>{t("plans.title")}</Link>
              </Button>
            </div>
          </TabsContent>

          {/* Credits tab — buying VX happens on the real checkout page (WishMoney/
              OMT/PayPal, admin-reviewed), not inline here; there's no payment
              provider integrated into this dialog. */}
          <TabsContent value="credits">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-10 text-center">
              <div className="rounded-full bg-amber-500/15 p-3">
                <Coins className="size-6 text-amber-400" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="font-semibold">Buy VX in the Coins Store</p>
                <p className="text-sm text-muted-foreground">
                  Pick any amount, pay via WishMoney, OMT, or PayPal, and your balance updates as soon as it's confirmed.
                </p>
              </div>
              <Button asChild onClick={onClose}>
                <Link to="/coins-store">
                  Go to Coins Store <ExternalLink className="ms-1.5 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
