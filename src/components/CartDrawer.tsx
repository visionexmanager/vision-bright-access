import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Plus, Minus, Trash2, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export function CartDrawer() {
  const { items, totalItems, totalPrice, totalPoints, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please log in to checkout and earn points.");
      return;
    }
    if (items.length === 0) return;

    const { error } = await supabase.from("user_points").insert({
      user_id: user.id,
      points: totalPoints,
      reason: `Marketplace purchase: ${items.map((i) => i.product.name).join(", ")}`,
    });

    if (error) {
      toast.error("Checkout failed. Please try again.");
    } else {
      toast.success(`Order placed! You earned ${totalPoints} points 🎉`);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["points-total"] });
      queryClient.invalidateQueries({ queryKey: ["points-history"] });
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Shopping cart with ${totalItems} items`}
        >
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md" aria-label="Shopping cart">
        <SheetHeader>
          <SheetTitle className="text-2xl">Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-lg text-muted-foreground">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">Add products from the marketplace to get started.</p>
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
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-base font-medium" aria-live="polite">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-8 w-8 text-destructive"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`Remove ${product.name} from cart`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base">
                <span className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4" aria-hidden="true" /> Points earned
                </span>
                <span className="font-bold text-primary">+{totalPoints}</span>
              </div>
              <Separator />
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  size="lg"
                  className="w-full text-base font-semibold"
                  onClick={handleCheckout}
                >
                  Checkout & Earn {totalPoints} Points
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full text-base"
                  onClick={clearCart}
                >
                  Clear Cart
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
