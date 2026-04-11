import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { ShoppingCart, Plus, Minus, Trash2, Star, X, Coins } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { formatVX } from "@/systems/pricingSystem";
import { VXPrice } from "@/components/VXPrice";

export function CartDrawer() {
  const { items, totalItems, totalPrice, totalPoints, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { balance, spendVX } = useVXWallet();
  const queryClient = useQueryClient();

  const canAfford = user && balance >= totalPrice && totalPrice > 0;

  const handleCheckout = async () => {
    if (!user) {
      toast.error(t("cart.loginRequired"));
      return;
    }
    if (items.length === 0) return;

    const itemNames = items.map((i) => `${i.product.name} x${i.quantity}`).join(", ");
    const success = await spendVX(totalPrice, "marketplace", itemNames, undefined);

    if (!success) return;

    // Award bonus points
    if (totalPoints > 0) {
      await supabase.rpc("award_points", {
        _points: totalPoints,
        _reason: `Purchase: ${itemNames}`,
      });
    }

    toast.success(t("cart.orderPlaced").replace("{points}", String(totalPoints)));
    clearCart();
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
                    <VXPrice amount={product.price} size="sm" />
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name}`}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-base font-medium" aria-live="polite">{quantity}</span>
                      <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="ms-auto h-10 w-10 text-destructive" onClick={() => removeFromCart(product.id)} aria-label={`Remove ${product.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              {user && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Coins className="h-4 w-4 text-primary" /> رصيدك</span>
                  <span className="font-semibold">{formatVX(balance)}</span>
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
                <span className="flex items-center gap-1"><Coins className="h-5 w-5 text-primary" />{formatVX(totalPrice)}</span>
              </div>
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  size="lg"
                  className="w-full text-base font-semibold"
                  onClick={handleCheckout}
                  disabled={!canAfford}
                >
                  <Coins className="me-2 h-5 w-5" />
                  {canAfford
                    ? `${t("cart.checkout").replace("{points}", String(totalPoints))}`
                    : t("vx.insufficientBalance") || "Insufficient VX Balance"}
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
