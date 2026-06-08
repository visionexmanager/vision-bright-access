import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useState } from "react";
import heroImg from "@/assets/game-fashion.jpg";

const FABRIC_KEYS = ["silk", "denim", "wool", "cotton", "satin"] as const;
const COLOR_KEYS = ["red", "blue", "green", "black", "white", "gold"] as const;
const STYLE_KEYS = ["dress", "suit", "casual", "coat", "traditional"] as const;

export default function FashionDesigner() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const { fashionSwish, fashionSewing, fashionApproval, fashionWrong } = useGameSounds();
  const [fabric, setFabric] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [designs, setDesigns] = useState<string[]>([]);

  const create = () => {
    if (!fabric || !color || !style) return;
    const design = t("fashion.designLabel")
      .replace("{style}", t(`fashion.style.${style}`))
      .replace("{color}", t(`fashion.color.${color}`))
      .replace("{fabric}", t(`fashion.fabric.${fabric}`));
    setDesigns([design, ...designs]);
    setFabric(null); setColor(null); setStyle(null);
    fashionSewing();
    setTimeout(fashionApproval, 400);
  };

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">👗 {t("fashion.title")}</h1>
            <Badge className="mt-2">{t("fashion.designs")}: {designs.length}</Badge>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.fabric")}</p>
              <div className="flex flex-col gap-1">
                {FABRIC_KEYS.map((f) => <Button key={f} size="sm" variant={fabric === f ? "default" : "outline"} onClick={() => { setFabric(f); fashionSwish(); }}>{t(`fashion.fabric.${f}`)}</Button>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.color")}</p>
              <div className="flex flex-col gap-1">
                {COLOR_KEYS.map((c) => <Button key={c} size="sm" variant={color === c ? "default" : "outline"} onClick={() => { setColor(c); fashionSwish(); }}>{t(`fashion.color.${c}`)}</Button>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="font-bold mb-2 text-center">{t("fashion.style")}</p>
              <div className="flex flex-col gap-1">
                {STYLE_KEYS.map((s) => <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => { setStyle(s); fashionSwish(); }}>{t(`fashion.style.${s}`)}</Button>)}
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
