import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback } from "react";
import heroImg from "@/assets/game-dreamhome.jpg";

const ROOM_KEYS = ["livingRoom", "bedroom", "kitchen", "bathroom"] as const;
const ITEM_KEYS: Record<string, string[]> = {
  livingRoom: ["sofa", "tv", "plant", "painting", "lamp", "bookshelf"],
  bedroom: ["bed", "curtains", "mirror", "decor", "nightLight", "wardrobe"],
  kitchen: ["stove", "fridge", "dishes", "herbs", "coffeeMaker", "rack"],
  bathroom: ["shower", "vanity", "dispenser", "mirror", "basket", "light"],
};

export default function DreamHome() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [room, setRoom] = useState<string>(ROOM_KEYS[0]);
  const [placed, setPlaced] = useState<Record<string, string[]>>({});
  const [budget, setBudget] = useState(5000);

  const placeItem = useCallback((item: string) => {
    if (budget < 200) { playSound("navigate"); return; }
    const current = placed[room] || [];
    if (current.includes(item)) return;
    setPlaced({ ...placed, [room]: [...current, item] });
    setBudget((b) => b - 200);
    playSound("success");
  }, [placed, room, budget, playSound]);

  const totalItems = Object.values(placed).flat().length;

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🏠 {t("dreamhome.title")}</h1>
            <div className="flex justify-center gap-4 mt-2">
              <Badge>💰 ${budget}</Badge>
              <Badge variant="secondary">🪑 {totalItems} {t("dreamhome.items")}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {ROOM_KEYS.map((r) => (
            <Button key={r} variant={room === r ? "default" : "outline"} onClick={() => setRoom(r)}>{t(`dreamhome.room.${r}`)}</Button>
          ))}
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="font-bold mb-3">{t("dreamhome.available")}:</p>
              <div className="flex flex-wrap gap-2">
                {ITEM_KEYS[room]?.map((item) => (
                  <Button key={item} variant="outline" size="sm" disabled={(placed[room] || []).includes(item)} onClick={() => placeItem(item)}>
                    {t(`dreamhome.item.${item}`)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="font-bold mb-3">{t("dreamhome.placed")}:</p>
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {(placed[room] || []).map((item) => (
                  <Badge key={item} variant="secondary">{t(`dreamhome.item.${item}`)}</Badge>
                ))}
                {!(placed[room] || []).length && <p className="text-muted-foreground text-sm">{t("dreamhome.empty")}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
