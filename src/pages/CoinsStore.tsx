import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Clock } from "lucide-react";
import { COIN_PACKAGES, calculatePackageTotal } from "@/systems/coinsSystem";
import { Link } from "react-router-dom";

export default function CoinsStore() {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <Layout>
      <section className="section-container py-12">
        <div className="mb-10 text-center">
          <Coins className="mx-auto mb-3 h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">{t("coins.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("coins.subtitle")}</p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-primary">{t("coins.purchaseTitle")}</span>
          </div>
          <p className="text-muted-foreground">{t("coins.comingSoonDesc")}</p>
        </div>

        {!user && (
          <div className="mb-8 rounded-lg border bg-muted/50 p-6 text-center">
            <p className="mb-3 text-muted-foreground">{t("coins.loginPrompt")}</p>
            <Button asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {COIN_PACKAGES.map((pkg) => {
            const { fee, total } = calculatePackageTotal(pkg.price);
            return (
              <Card key={pkg.coins} className="relative transition-shadow hover:shadow-lg opacity-75">
                <div className="absolute top-3 end-3">
                  <Badge variant="secondary" className="text-xs">
                    {t("coins.purchaseTitle")}
                  </Badge>
                </div>
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
                  <Button className="w-full" disabled>
                    <Clock className="mr-2 h-4 w-4" />
                    {t("coins.purchaseTitle")}
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
