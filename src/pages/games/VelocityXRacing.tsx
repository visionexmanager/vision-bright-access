import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";

const TRACKS = ["🏎️ Monaco GP", "🏁 Neon Sprint", "🌊 Coastal Rush", "🏜️ Desert Blitz"];

export default function VelocityXRacing() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [lap, setLap] = useState(1);
  const [track] = useState(() => TRACKS[Math.floor(Math.random() * TRACKS.length)]);
  const [racing, setRacing] = useState(false);
  const [finished, setFinished] = useState(false);
  const lapDistance = 1000;
  const totalLaps = 3;

  const start = () => { setSpeed(0); setDistance(0); setFuel(100); setLap(1); setRacing(true); setFinished(false); playSound("start"); };

  useEffect(() => {
    if (!racing) return;
    const interval = setInterval(() => {
      setDistance((d) => {
        const newD = d + speed;
        if (newD >= lapDistance * totalLaps) { setRacing(false); setFinished(true); return newD; }
        if (newD >= lapDistance * lap) setLap((l) => l + 1);
        return newD;
      });
      setFuel((f) => {
        const newF = f - speed * 0.05;
        if (newF <= 0) { setRacing(false); setFinished(true); return 0; }
        return newF;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [racing, speed, lap]);

  const accelerate = () => setSpeed((s) => Math.min(s + 10, 100));
  const brake = () => setSpeed((s) => Math.max(s - 20, 0));
  const nitro = useCallback(() => {
    if (fuel < 20) return;
    setSpeed(100);
    setFuel((f) => f - 20);
    playSound("success");
  }, [fuel, playSound]);

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">🏎️ {t("velocity.title")}</h1>
          <p className="text-muted-foreground">{track}</p>
          <div className="flex justify-center gap-4 mt-3">
            <Badge>{t("velocity.lap")}: {Math.min(lap, totalLaps)}/{totalLaps}</Badge>
            <Badge variant="secondary">🏎️ {speed} km/h</Badge>
            <Badge variant={fuel < 20 ? "destructive" : "outline"}>⛽ {Math.round(fuel)}%</Badge>
          </div>
        </div>
        {!racing && !finished ? (
          <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={start}>🏁 {t("velocity.start")}</Button></CardContent></Card>
        ) : finished ? (
          <Card><CardContent className="pt-6 text-center space-y-4">
            <p className="text-5xl">{fuel > 0 ? "🏆" : "⛽"}</p>
            <p className="text-2xl font-bold">{fuel > 0 ? t("velocity.finished") : t("velocity.outOfFuel")}</p>
            <p>{t("velocity.distance")}: {Math.round(distance)}m</p>
            <Button size="lg" onClick={start}>{t("velocity.restart")}</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Progress value={(distance / (lapDistance * totalLaps)) * 100} />
              <p className="text-center text-sm text-muted-foreground">{Math.round(distance)}m / {lapDistance * totalLaps}m</p>
              <div className="flex justify-center gap-3">
                <Button size="lg" onClick={accelerate}>⬆️ {t("velocity.gas")}</Button>
                <Button size="lg" variant="destructive" onClick={brake}>⬇️ {t("velocity.brake")}</Button>
                <Button size="lg" variant="secondary" onClick={nitro} disabled={fuel < 20}>🔥 Nitro</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
