import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Store, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type BazaarShop = {
  id: string; name: string; tier: string; description: string | null;
  is_active: boolean; owner_id: string; created_at: string;
  ownerName?: string; productCount?: number;
};

export default function AdminBazaar() {
  const { t } = useLanguage();
  const [shops, setShops] = useState<BazaarShop[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: shopData } = await supabase.from("bazaar_shops").select("*").order("created_at", { ascending: false });
    if (!shopData) { setLoading(false); return; }

    const ownerIds = [...new Set(shopData.map((s) => s.owner_id))];
    const { data: profileData } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ownerIds);
    const profileMap: Record<string, string> = {};
    profileData?.forEach((p) => { profileMap[p.user_id] = p.display_name ?? p.user_id; });

    const shopIds = shopData.map((s) => s.id);
    const { data: prodData } = await supabase.from("bazaar_products").select("shop_id").in("shop_id", shopIds);
    const prodCount: Record<string, number> = {};
    prodData?.forEach((p) => { prodCount[p.shop_id] = (prodCount[p.shop_id] ?? 0) + 1; });

    setShops(shopData.map((s) => ({ ...s, ownerName: profileMap[s.owner_id] ?? s.owner_id, productCount: prodCount[s.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (shop: BazaarShop) => {
    const next = !shop.is_active;
    const { error } = await supabase.from("bazaar_shops").update({ is_active: next }).eq("id", shop.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? t("admin.bazaar.activated") : t("admin.bazaar.suspended"));
    setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, is_active: next } : s));
  };

  const tierColor = (tier: string) => {
    if (tier === "premium") return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
    if (tier === "standard") return "bg-blue-500/10 text-blue-600 border-blue-200";
    return "bg-gray-500/10 text-gray-600 border-gray-200";
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <Store className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">{t("admin.bazaar.title")}</h1>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">{t("admin.common.loading")}</div>
            ) : shops.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">{t("admin.bazaar.noShops")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.bazaar.shopName")}</TableHead>
                    <TableHead>{t("admin.bazaar.owner")}</TableHead>
                    <TableHead>{t("admin.bazaar.tier")}</TableHead>
                    <TableHead><Package className="inline h-4 w-4 me-1" />{t("admin.bazaar.products")}</TableHead>
                    <TableHead>{t("admin.bazaar.status")}</TableHead>
                    <TableHead>{t("admin.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map((shop) => (
                    <TableRow key={shop.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{shop.name}</p>
                          {shop.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{shop.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{shop.ownerName}</TableCell>
                      <TableCell><Badge variant="outline" className={tierColor(shop.tier)}>{t(`admin.bazaar.tier.${shop.tier}`)}</Badge></TableCell>
                      <TableCell>{shop.productCount}</TableCell>
                      <TableCell>
                        <Badge variant={shop.is_active ? "default" : "secondary"}>
                          {shop.is_active ? t("admin.bazaar.active") : t("admin.bazaar.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={shop.is_active ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleActive(shop)}
                        >
                          {shop.is_active ? t("admin.bazaar.suspend") : t("admin.bazaar.activate")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
