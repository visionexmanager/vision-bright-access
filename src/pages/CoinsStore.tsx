import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, ShieldCheck } from "lucide-react";
import { COIN_PACKAGES, calculatePackageTotal } from "@/systems/coinsSystem";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function CoinsStore() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const handleBuy = (coins: number) => {
    toast({
      title: t("coins.purchaseTitle"),
      description: t("coins.purchaseDesc").replace("{coins}", coins.toLocaleString()),
    });
  };

  return (
    <Layout>
      <section className="section-container py-12">
        <div className="mb-10 text-center">
          <Coins className="mx-auto mb-3 h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">{t("coins.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("coins.subtitle")}</p>
        </div>

        {!user && (
          <div className="mb-8 rounded-lg border bg-muted/50 p-6 text-center">
            <p className="mb-3 text-muted-foreground">{t("coins.loginPrompt")}</p>
            <Button asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COIN_PACKAGES.map((pkg) => {
            const { fee, total } = calculatePackageTotal(pkg.price);
            return (
              <Card key={pkg.coins} className="transition-shadow hover:shadow-lg">
                <CardHeader className="text-center">
                  <CardTitle className="text-3xl font-extrabold text-primary">
                    {pkg.coins.toLocaleString()} VX
                  </CardTitle>
                  <CardDescription className="text-base">
                    ${pkg.price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t("coins.fee")}</span>
                    <span>${fee}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>{t("coins.total")}</span>
                    <span>${total}</span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!user}
                    onClick={() => handleBuy(pkg.coins)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {t("coins.buy")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
