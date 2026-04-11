import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Coins, ShoppingBag, Calendar, Loader2 } from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";

export default function PurchaseHistory() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["vx-purchases", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vx_purchases")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);

  const typeColors: Record<string, string> = {
    game: "bg-purple-500/20 text-purple-400",
    course: "bg-blue-500/20 text-blue-400",
    article: "bg-green-500/20 text-green-400",
    simulation: "bg-orange-500/20 text-orange-400",
    service: "bg-pink-500/20 text-pink-400",
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isRTL ? "سجل المشتريات" : "Purchase History"}</h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الإنفاق" : "Total Spent"}</p>
                <p className="text-lg font-bold text-primary">{formatVX(totalSpent)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "عدد العمليات" : "Transactions"}</p>
                <p className="text-lg font-bold">{purchases.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isRTL ? "جميع المشتريات" : "All Purchases"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{isRTL ? "لا توجد مشتريات بعد" : "No purchases yet"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "العنصر" : "Item"}</TableHead>
                    <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isRTL ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.item_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeColors[p.item_type] || ""}>{p.item_type}</Badge>
                      </TableCell>
                      <TableCell className="text-primary font-semibold">{formatVX(p.amount)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.created_at).toLocaleDateString(isRTL ? "ar" : "en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
