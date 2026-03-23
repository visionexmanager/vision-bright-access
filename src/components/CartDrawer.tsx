import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePoints } from "@/hooks/usePoints";
import { ShoppingCart, Plus, Minus, Trash2, Star, Gift, X, Coins } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const REDEEM_TIERS = [
  { points: 50, discount: 5, labelKey: "redeem.tier1" },
  { points: 100, discount: 12, labelKey: "redeem.tier2" },
  { points: 200, discount: 25, labelKey: "redeem.tier3" },
  { points: 500, discount: 75, labelKey: "redeem.tier4" },
];

const POINTS_PER_DOLLAR = 10; // 10 points = $1

export function CartDrawer() {
  const { items, totalItems, totalPrice, totalPoints, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { totalPoints: userPoints } = usePoints();
  const queryClient = useQueryClient();
  const [appliedTier, setAppliedTier] = useState<typeof REDEEM_TIERS[number] | null>(null);

  const discountAmount = appliedTier ? Math.min(appliedTier.discount, totalPrice) : 0;
  const finalPrice = totalPrice - discountAmount;
  const pointsCostForFullPurchase = Math.ceil(totalPrice * POINTS_PER_DOLLAR);
  const canPayWithPointsOnly = user && userPoints >= pointsCostForFullPurchase && totalPrice > 0;

  const handleApplyTier = (tier: typeof REDEEM_TIERS[number]) => {
    if (!user) {
      toast.error(t("redeem.loginToRedeem"));
      return;
    }
    if (userPoints < tier.points) {
      toast.error(t("redeem.notEnough").replace("{points}", String(tier.points)));
      return;
    }
    setAppliedTier(tier);
    toast.success(t("redeem.applied").replace("{amount}", String(Math.min(tier.discount, totalPrice).toFixed(2))));
  };

  const handleRemoveTier = () => {
    setAppliedTier(null);
    toast.success(t("redeem.removed"));
  };

  const handlePayWithPointsOnly = async () => {
    if (!user || !canPayWithPointsOnly) return;

    // Deduct points for the full purchase price
    const { error: deductError } = await supabase.from("user_points").insert({
      user_id: user.id,
      points: -pointsCostForFullPurchase,
      reason: `Points purchase: ${items.map((i) => i.product.name).join(", ")}`,
    });

    if (deductError) {
      toast.error(t("cart.checkoutFailed"));
      return;
    }

    // Still earn bonus points from the purchase
    const { error: earnError } = await supabase.from("user_points").insert({
      user_id: user.id,
      points: totalPoints,
      reason: `Bonus from purchase: ${items.map((i) => i.product.name).join(", ")}`,
    });

    toast.success(t("cart.paidWithPoints").replace("{points}", String(pointsCostForFullPurchase)));
    clearCart();
    setAppliedTier(null);
    queryClient.invalidateQueries({ queryKey: ["points-total"] });
    queryClient.invalidateQueries({ queryKey: ["points-history"] });
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error(t("cart.loginRequired"));
      return;
    }
    if (items.length === 0) return;

    // Insert earned points
    const { error: earnError } = await supabase.from("user_points").insert({
      user_id: user.id,
      points: totalPoints,
      reason: `Marketplace purchase: ${items.map((i) => i.product.name).join(", ")}`,
    });

    if (earnError) {
      toast.error(t("cart.checkoutFailed"));
      return;
    }

    // Deduct redeemed points if a tier was applied
    if (appliedTier) {
      const { error: redeemError } = await supabase.from("user_points").insert({
        user_id: user.id,
        points: -appliedTier.points,
        reason: `Redeemed ${appliedTier.points} pts for $${discountAmount.toFixed(2)} discount`,
      });

      if (redeemError) {
        toast.error(t("cart.checkoutFailed"));
        return;
      }
    }

    toast.success(
      appliedTier
        ? `${t("cart.orderPlaced").replace("{points}", String(totalPoints))} (-${appliedTier.points} redeemed)`
        : t("cart.orderPlaced").replace("{points}", String(totalPoints))
    );
    clearCart();
    setAppliedTier(null);
    queryClient.invalidateQueries({ queryKey: ["points-total"] });
    queryClient.invalidateQueries({ queryKey: ["points-history"] });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={t("cart.itemsLabel").replace("{count}", String(totalItems))}
        >
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -end-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md" aria-label={t("cart.title")}>
        <SheetHeader>
          <SheetTitle className="text-2xl">{t("cart.title")}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-lg text-muted-foreground">{t("cart.empty")}</p>
            <p className="text-sm text-muted-foreground">{t("cart.emptyDesc")}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-start gap-4 rounded-lg border p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
                    {product.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-base font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name}`}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-base font-medium" aria-live="polite">{quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="ms-auto h-8 w-8 text-destructive" onClick={() => removeFromCart(product.id)} aria-label={`Remove ${product.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Redeem Points Section */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="text-base font-bold">{t("redeem.title")}</h3>
                </div>
                {user ? (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t("redeem.available").replace("{points}", String(userPoints))}
                    </p>
                    {appliedTier ? (
                      <div className="flex items-center justify-between rounded-md border border-primary bg-primary/10 p-3">
                        <div>
                          <p className="text-sm font-semibold text-primary">{t(appliedTier.labelKey)}</p>
                          <p className="text-xs text-muted-foreground">-${discountAmount.toFixed(2)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemoveTier} aria-label={t("redeem.remove")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {REDEEM_TIERS.map((tier) => (
                          <Button
                            key={tier.points}
                            variant={userPoints >= tier.points ? "outline" : "ghost"}
                            size="sm"
                            disabled={userPoints < tier.points}
                            onClick={() => handleApplyTier(tier)}
                            className="h-auto flex-col items-start gap-0.5 py-2 text-start"
                          >
                            <span className="text-xs font-semibold">{t(tier.labelKey)}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("redeem.loginToRedeem")}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="font-semibold">${totalPrice.toFixed(2)}</span>
              </div>
              {appliedTier && (
                <div className="flex justify-between text-base">
                  <span className="flex items-center gap-1 text-destructive">
                    <Gift className="h-4 w-4" aria-hidden="true" /> {t("redeem.discount")}
                  </span>
                  <span className="font-bold text-destructive">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base">
                <span className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4" aria-hidden="true" /> {t("cart.pointsEarned")}
                </span>
                <span className="font-bold text-primary">+{totalPoints}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t("cart.total")}</span>
                <span>${finalPrice.toFixed(2)}</span>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button size="lg" className="w-full text-base font-semibold" onClick={handleCheckout}>
                  {t("cart.checkout").replace("{points}", String(totalPoints))}
                </Button>
                <Button variant="outline" size="lg" className="w-full text-base" onClick={clearCart}>
                  {t("cart.clear")}
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
