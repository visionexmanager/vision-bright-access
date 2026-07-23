import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookCoupons, createCoupon, setCouponActive } from "@/services/library/pricing";
import type { LibraryCouponRow } from "@/lib/types/library-studio";

interface CouponManagerProps {
  bookId: string;
}

export function CouponManager({ bookId }: CouponManagerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<LibraryCouponRow["discount_type"]>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: coupons = [], isLoading } = useQuery({ queryKey: queryKeys.library.studio.coupons(bookId), queryFn: () => fetchBookCoupons(bookId) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.coupons(bookId) });

  const handleCreate = async () => {
    if (!user || !code.trim() || !discountValue) return;
    setIsCreating(true);
    try {
      await createCoupon({ book_id: bookId, code, discount_type: discountType, discount_value: Number(discountValue), created_by: user.id });
      setCode("");
      setDiscountValue("");
      invalidate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.pricing.coupons")}</h3>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.studio.pricing.couponsEmpty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <span className="font-mono font-medium">{coupon.code}</span>{" "}
                <span className="text-muted-foreground">
                  {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `${coupon.discount_value} ${coupon.discount_type === "fixed_vx" ? "VX" : "USD"}`}
                </span>
                {coupon.max_redemptions && <span className="ms-1 text-xs text-muted-foreground">({coupon.redemptions_count}/{coupon.max_redemptions})</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={coupon.is_active ? "default" : "outline"}>{coupon.is_active ? t("library.studio.pricing.active") : t("library.studio.pricing.inactive")}</Badge>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void setCouponActive(coupon.id, !coupon.is_active).then(invalidate)}>
                  {coupon.is_active ? t("library.studio.pricing.deactivate") : t("library.studio.pricing.activate")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("library.studio.pricing.couponCode")} className="col-span-1" />
        <Select value={discountType} onValueChange={(v) => setDiscountType(v as LibraryCouponRow["discount_type"])}>
          <SelectTrigger aria-label={t("library.studio.pricing.discountType")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">%</SelectItem>
            <SelectItem value="fixed_usd">USD</SelectItem>
            <SelectItem value="fixed_vx">VX</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={t("library.studio.pricing.discountValue")} />
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void handleCreate()} disabled={isCreating || !code.trim() || !discountValue}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t("library.studio.pricing.createCoupon")}
      </Button>
    </div>
  );
}
