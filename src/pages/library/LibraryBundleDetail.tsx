import { useState } from "react";
import { useParams } from "react-router-dom";
import { PackagePlus, Coins, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useBundleDetail } from "@/hooks/library/useBundleDetail";
import { useLibraryCheckout } from "@/hooks/library/useLibraryCheckout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryBundleDetail() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { bundleId } = useParams<{ bundleId: string }>();
  const { bundle, isLoading } = useBundleDetail(bundleId);
  const { checkout, isProcessing } = useLibraryCheckout();
  const [paymentMethod, setPaymentMethod] = useState<"vx" | "cash">("vx");

  return (
    <Layout>
      <LibraryLayout title={bundle?.title ?? t("library.nav.home")} breadcrumb={bundle ? [{ label: bundle.title }] : []}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !bundle ? (
          <EmptyState icon={<PackagePlus className="h-10 w-10" />} title={t("library.emptyState.bundleNotFoundTitle")} actionLabel={t("library.nav.home")} actionTo="/library" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
              <h2 className="flex items-center gap-2 text-2xl font-bold"><PackagePlus className="h-6 w-6" aria-hidden="true" /> {bundle.title}</h2>
              {bundle.description && <p className="mt-2 max-w-2xl text-muted-foreground">{bundle.description}</p>}
              <p className="mt-2 text-sm text-muted-foreground">{t("library.bookDetails.bundleIncludes").replace("{count}", String(bundle.books.length))}</p>

              {user && (
                <div className="mt-4 space-y-3">
                  {bundle.price_vx != null && bundle.price_usd != null && (
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "vx" | "cash")} className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="vx" id="bundle-pay-vx" />
                        <Label htmlFor="bundle-pay-vx" className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" />{bundle.price_vx} VX</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="cash" id="bundle-pay-cash" />
                        <Label htmlFor="bundle-pay-cash">${bundle.price_usd}</Label>
                      </div>
                    </RadioGroup>
                  )}
                  <Button
                    size="lg"
                    disabled={isProcessing}
                    onClick={() => void checkout({ bundle_id: bundle.id, payment_method: paymentMethod, pricing_model: "bundle" })}
                  >
                    {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t("library.bundle.buy")} — {paymentMethod === "vx" && bundle.price_vx != null ? `${bundle.price_vx} VX` : `$${bundle.price_usd}`}
                  </Button>
                </div>
              )}
            </div>
            <BookGrid books={bundle.books} />
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
