import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState } from "react";
import heroImg from "@/assets/game-tradetycoon.jpg";

const GOODS = [
  { name: "☕ Coffee", buy: 10, volatility: 8 },
  { name: "🛢️ Oil", buy: 50, volatility: 20 },
  { name: "💎 Diamonds", buy: 200, volatility: 60 },
  { name: "📱 Tech", buy: 80, volatility: 30 },
];

export default function TradeTycoon() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [cash, setCash] = useState(1000);
  const [day, setDay] = useState(1);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState(() => GOODS.map((g) => g.buy));
  const [qty, setQty] = useState<Record<string, string>>({});

  const buy = (idx: number) => {
    const amount = parseInt(qty[GOODS[idx].name] || "0");
    if (!amount || amount <= 0) return;
    const cost = amount * prices[idx];
    if (cost > cash) { playSound("navigate"); return; }
    setCash((c) => c - cost);
    setInventory((inv) => ({ ...inv, [GOODS[idx].name]: (inv[GOODS[idx].name] || 0) + amount }));
    setQty((q) => ({ ...q, [GOODS[idx].name]: "" }));
    playSound("success");
  };

  const sell = (idx: number) => {
    const have = inventory[GOODS[idx].name] || 0;
    if (!have) return;
    setCash((c) => c + have * prices[idx]);
    setInventory((inv) => ({ ...inv, [GOODS[idx].name]: 0 }));
    playSound("success");
  };

  const nextDay = () => {
    setPrices(GOODS.map((g, i) => Math.max(1, prices[i] + Math.floor((Math.random() - 0.45) * g.volatility))));
    setDay((d) => d + 1);
    playSound("start");
  };

  const totalValue = cash + GOODS.reduce((sum, g, i) => sum + (inventory[g.name] || 0) * prices[i], 0);

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">📈 {t("tradetycoon.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>💰 ${cash}</Badge>
              <Badge variant="secondary">{t("tradetycoon.day")} {day}</Badge>
              <Badge variant="outline">{t("tradetycoon.netWorth")}: ${totalValue}</Badge>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {GOODS.map((good, i) => (
            <Card key={good.name}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold">{good.name}</p>
                    <p className="text-sm text-muted-foreground">${prices[i]} | {t("tradetycoon.owned")}: {inventory[good.name] || 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="1" className="w-20" value={qty[good.name] || ""} onChange={(e) => setQty((q) => ({ ...q, [good.name]: e.target.value }))} placeholder="Qty" />
                    <Button size="sm" onClick={() => buy(i)}>{t("tradetycoon.buy")}</Button>
                    <Button size="sm" variant="secondary" onClick={() => sell(i)}>{t("tradetycoon.sell")}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button className="w-full mt-6" size="lg" onClick={nextDay}>{t("tradetycoon.nextDay")} →</Button>
      </section>
    </Layout>
  );
}
