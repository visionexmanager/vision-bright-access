import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useEffect, useCallback } from "react";
import heroImg from "@/assets/game-velocity.jpg";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { MultiplayerLobby } from "@/components/multiplayer/MultiplayerLobby";
import { WaitingRoom } from "@/components/multiplayer/WaitingRoom";
import { FinishBanner } from "@/components/multiplayer/OpponentPanel";
import { useAuth } from "@/contexts/AuthContext";
import { seededRng } from "@/systems/multiplayerSystem";

const TRACKS = ["🏎️ Monaco GP", "🏁 Neon Sprint", "🌊 Coastal Rush", "🏜️ Desert Blitz"];
const LAP_DISTANCE = 1000;
const TOTAL_LAPS = 3;
const TOTAL_DISTANCE = LAP_DISTANCE * TOTAL_LAPS;

function trackFromSeed(seed: number) {
  const rng = seededRng(seed);
  return TRACKS[Math.floor(rng() * TRACKS.length) % TRACKS.length];
}

function RaceControls({
  distance,
  fuel,
  onAccelerate,
  onBrake,
  onNitro,
}: {
  distance: number;
  fuel: number;
  onAccelerate: () => void;
  onBrake: () => void;
  onNitro: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Progress value={(distance / TOTAL_DISTANCE) * 100} />
        <p className="text-center text-sm text-muted-foreground">{Math.round(distance)}m / {TOTAL_DISTANCE}m</p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Button size="lg" onClick={onAccelerate}>⬆️ {t("velocity.gas")}</Button>
          <Button size="lg" variant="destructive" onClick={onBrake}>⬇️ {t("velocity.brake")}</Button>
          <Button size="lg" variant="secondary" onClick={onNitro} disabled={fuel < 20}>🔥 Nitro</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function useRaceEngine(onFinish: (distance: number, fuel: number) => void) {
  const { playSound } = useSound();
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [lap, setLap] = useState(1);
  const [racing, setRacing] = useState(false);
  const [finished, setFinished] = useState(false);

  const start = () => {
    setSpeed(0);
    setDistance(0);
    setFuel(100);
    setLap(1);
    setRacing(true);
    setFinished(false);
    playSound("start");
  };

  useEffect(() => {
    if (!racing) return;
    const interval = setInterval(() => {
      setDistance((d) => {
        const newD = d + speed;
        if (newD >= TOTAL_DISTANCE) {
          setRacing(false);
          setFinished(true);
          onFinish(newD, fuel);
          return newD;
        }
        if (newD >= LAP_DISTANCE * lap) setLap((l) => l + 1);
        return newD;
      });
      setFuel((f) => {
        const newF = f - speed * 0.05;
        if (newF <= 0) {
          setRacing(false);
          setFinished(true);
          onFinish(distance, 0);
          return 0;
        }
        return newF;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [racing, speed, lap, fuel, distance, onFinish]);

  const accelerate = () => setSpeed((s) => Math.min(s + 10, 100));
  const brake = () => setSpeed((s) => Math.max(s - 20, 0));
  const nitro = useCallback(() => {
    setFuel((f) => {
      if (f < 20) return f;
      setSpeed(100);
      playSound("success");
      return f - 20;
    });
  }, [playSound]);

  return { speed, distance, fuel, lap, racing, finished, start, accelerate, brake, nitro };
}

function VelocitySolo({ track }: { track: string }) {
  const { t } = useLanguage();
  const race = useRaceEngine(() => {});

  if (!race.racing && !race.finished) {
    return <Card><CardContent className="pt-6 text-center"><Button size="lg" onClick={race.start}>🏁 {t("velocity.start")}</Button></CardContent></Card>;
  }

  if (race.finished) {
    return (
      <Card><CardContent className="pt-6 text-center space-y-4">
        <p className="text-5xl">{race.fuel > 0 ? "🏆" : "⛽"}</p>
        <p className="text-2xl font-bold">{race.fuel > 0 ? t("velocity.finished") : t("velocity.outOfFuel")}</p>
        <p>{t("velocity.distance")}: {Math.round(race.distance)}m</p>
        <Button size="lg" onClick={race.start}>{t("velocity.restart")}</Button>
      </CardContent></Card>
    );
  }

  return <RaceControls distance={race.distance} fuel={race.fuel} onAccelerate={race.accelerate} onBrake={race.brake} onNitro={race.nitro} />;
}

function VelocityMulti() {
  const { user } = useAuth();
  const mp = useMultiplayer("velocity");
  const gs = mp.session?.game_state as Record<string, unknown> | null;
  const seed = (gs?.seed as number) ?? 7;
  const opp = mp.opponents[0];
  const oppScore = mp.session?.players.find((p) => p.id !== user?.id)?.score ?? 0;
  const bothDone = gs && user && opp ? gs[`fin_${user.id}`] === true && gs[`fin_${opp.id}`] === true : false;

  const finishRace = useCallback((distance: number, fuel: number) => {
    const score = Math.round(distance) + (fuel > 0 ? 1000 : 0);
    mp.updateMyScore(score, true);
  }, [mp]);

  const race = useRaceEngine(finishRace);

  useEffect(() => {
    if (mp.status === "playing" && !race.racing && !race.finished) race.start();
  }, [mp.status, race]);

  useEffect(() => {
    if (bothDone && mp.status === "playing") {
      const sorted = [...mp.session!.players].sort((a, b) => b.score - a.score);
      mp.endGame(sorted[0].score !== sorted[1]?.score ? sorted[0].id : undefined);
    }
  }, [bothDone, mp]);

  if (mp.status === "idle")
    return <MultiplayerLobby gameType="velocity" loading={mp.loading} onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom} />;
  if (mp.status === "waiting")
    return <WaitingRoom session={mp.session!} isHost={mp.isHost} onStart={() => mp.startGame({ seed: Math.floor(Math.random() * 999999) })} onLeave={mp.leaveRoom} />;
  if (mp.status === "finished")
    return <FinishBanner winnerId={mp.session!.winner_id} myId={user?.id ?? ""} players={mp.session!.players} onRematch={mp.leaveRoom} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between rounded-lg border p-3 text-sm">
        <div className="text-center"><p className="text-xs text-muted-foreground">You</p><p className="text-xl font-bold text-primary">{Math.round(race.distance)}</p></div>
        <Badge variant="outline">{trackFromSeed(seed)}</Badge>
        <div className="text-center"><p className="text-xs text-muted-foreground">{opp?.name ?? "Opponent"}</p><p className="text-xl font-bold">{oppScore}</p></div>
      </div>
      {race.finished ? (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className="text-xl font-bold">Finished! ✅</p>
          <p className="text-muted-foreground">Waiting for opponent…</p>
        </CardContent></Card>
      ) : (
        <RaceControls distance={race.distance} fuel={race.fuel} onAccelerate={race.accelerate} onBrake={race.brake} onNitro={race.nitro} />
      )}
    </div>
  );
}

export default function VelocityXRacing() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"solo" | "multi">("solo");
  const [track] = useState(() => TRACKS[Math.floor(Math.random() * TRACKS.length)]);

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="relative mb-6 overflow-hidden rounded-2xl">
          <img src={heroImg} alt="" role="presentation" className="h-40 w-full object-cover sm:h-48" width={800} height={512} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <h1 className="text-3xl font-bold">🏎️ {t("velocity.title")}</h1>
            <p className="text-muted-foreground">{track}</p>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border mb-6">
          <button onClick={() => setMode("solo")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "solo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>🎮 Solo</button>
          <button onClick={() => setMode("multi")} className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "multi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>👥 Online</button>
        </div>
        {mode === "solo" ? <VelocitySolo track={track} /> : <VelocityMulti />}
      </section>
    </Layout>
  );
}
