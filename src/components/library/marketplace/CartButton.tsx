import { ShoppingCart, X, Coins, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLibraryCart } from "@/hooks/library/useLibraryCart";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/** Cart is localStorage-backed (see useLibraryCart's own header comment) —
 *  always visible so guests can build a cart before signing in, but
 *  checkout itself requires auth like every other purchase action. */
export function CartButton() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { items, removeItem, checkoutAllWithVx, isCheckingOut, totalVx, totalUsd } = useLibraryCart();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("library.cart.title")}>
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          {items.length > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
              {items.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("library.cart.title")}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("library.cart.empty")}</p>
        ) : (
          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {items.map((item) => (
              <div key={item.bookId} className="flex items-center gap-3 rounded-lg border p-2">
                {item.coverImageUrl ? (
                  <img src={item.coverImageUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.priceVx ? (
                      <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" aria-hidden="true" />{item.priceVx} VX</span>
                    ) : item.priceUsd ? (
                      `$${item.priceUsd}`
                    ) : null}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.bookId)} aria-label={t("library.cart.remove")}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="mt-4 flex-col gap-2 sm:flex-col">
            <div className="flex w-full items-center justify-between text-sm font-semibold">
              <span>{t("library.cart.total")}</span>
              <span>{totalVx > 0 ? `${totalVx} VX` : `$${totalUsd.toFixed(2)}`}</span>
            </div>
            <Button className="w-full" disabled={!user || isCheckingOut} onClick={() => void checkoutAllWithVx()}>
              {isCheckingOut && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {user ? t("library.cart.checkoutAll") : t("library.cart.signInToCheckout")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
