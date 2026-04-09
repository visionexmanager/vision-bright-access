import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState } from "react";

const FABRICS = ["🧵 Silk", "👖 Denim", "🧶 Wool", "🪡 Cotton", "✨ Satin"];
const COLORS_LIST = ["❤️ Red", "💙 Blue", "💚 Green", "🖤 Black", "🤍 White", "💛 Gold"];
const STYLES = ["👗 Dress", "👔 Suit", "👕 Casual", "🧥 Coat", "👘 Traditional"];

export default function FashionDesigner() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [fabric, setFabric] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [designs, setDesigns] = useState<string[]>([]);

  const create = () => {
    if (!fabric || !color || !style) return;
    const design = `${style} in ${color} ${fabric}`;
    setDesigns([design, ...designs]);
    setFabric(null); setColor(null); setStyle(null);
    playSound("success");
  };

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">👗 {t("fashion.title")}</h1>
          <Badge className="mt-2">{t("fashion.designs")}: {designs.length}</Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.fabric")}</p>
              <div className="flex flex-col gap-1">
                {FABRICS.map((f) => <Button key={f} size="sm" variant={fabric === f ? "default" : "outline"} onClick={() => setFabric(f)}>{f}</Button>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.color")}</p>
              <div className="flex flex-col gap-1">
                {COLORS_LIST.map((c) => <Button key={c} size="sm" variant={color === c ? "default" : "outline"} onClick={() => setColor(c)}>{c}</Button>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.style")}</p>
              <div className="flex flex-col gap-1">
                {STYLES.map((s) => <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => setStyle(s)}>{s}</Button>)}
              </div>
            </CardContent>
          </Card>
        </div>
        <Button className="w-full" size="lg" onClick={create} disabled={!fabric || !color || !style}>{t("fashion.create")}</Button>
        {designs.length > 0 && (
          <Card className="mt-6">
            <CardContent className="pt-4">
              <p className="font-bold mb-3">{t("fashion.collection")}:</p>
              <div className="space-y-2">
                {designs.map((d, i) => <Badge key={i} variant="secondary" className="block py-2 text-base">{d}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
