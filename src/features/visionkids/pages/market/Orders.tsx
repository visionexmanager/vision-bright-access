import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useOrders } from "@/features/visionkids/hooks/market/useMarketCommerce";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";

export default function Orders() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useOrders();

  useDocumentHead({
    title: `${t("kids.market.nav.orders")} — VisionKids`,
    description: t("kids.market.orders.subtitle"),
    canonicalPath: "/kids/market/orders",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="🧾" title={t("kids.market.nav.orders")} subtitle={t("kids.market.orders.subtitle")} />

      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.market.orders.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <span className="text-3xl" aria-hidden="true">{o.product?.emoji ?? "📦"}</span>
              <div className="min-w-0 flex-1">
                {o.product ? (
                  <Link to={`/kids/market/product/${o.product.slug}`} className="font-heading font-bold hover:underline">{o.product.title}</Link>
                ) : (
                  <span className="font-heading font-bold text-muted-foreground">{t("kids.market.orders.removed")}</span>
                )}
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              {o.price_coins > 0 ? (
                <span className="flex items-center gap-1 text-sm font-bold text-kids-accent"><Coins className="h-3.5 w-3.5" aria-hidden="true" /> {o.price_coins.toLocaleString()}</span>
              ) : (
                <span className="text-sm font-bold text-kids-green">{t("kids.market.free")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
