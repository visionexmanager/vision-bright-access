import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, ChevronRight, Gamepad2, Heart, Info, Keyboard, Medal, Pause, Play, RotateCcw, Star, Users } from "lucide-react";
import { EmbeddedLayout, Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameSettingsPanel } from "./GameSettingsPanel";
import { GameRating } from "./GameRating";
import { ArcadeAccessibilityProvider, useArcadeAccessibility } from "./core/ArcadeAccessibilityProvider";
import { gameManager } from "./core/gameManager";
import { usePlayerGameData } from "./core/usePlayerGameData";
import { ArcadeGameCard } from "./ArcadeGameCard";
import { ARCADE_GAMES, getArcadeGame, localizeGame } from "./catalog";
import { categoryLabel, difficultyLabel } from "./labels";
import { accessibilityAudio } from "./audio/AccessibilityAudioLayer";
import { advancedAudioEngine } from "./audio/AdvancedAudioEngine";
import arcadeLoadingBackground from "@/assets/arcade/visionex-arcade-loading.webp";
import { ArcadeVisual } from "./visual/ArcadeVisual";
import { applyGraphicsProfile } from "./visual/graphicsQuality";
import { visualForGame } from "./visual/visualRegistry";
import { ARCADE_ACHIEVEMENTS } from "./core/achievements";
import { readFavoriteGames, toggleFavoriteGame } from "./player/gamerProfile";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { gameReleaseInfo } from "./gameReleaseNotes";

export function ArcadeGameExperience({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const game = getArcadeGame(pathname);
  if (!game) return <>{children}</>;
  return <ArcadeAccessibilityProvider><ArcadeGameRuntime gameId={game.slug}>{children}</ArcadeGameRuntime></ArcadeAccessibilityProvider>;
}

function ArcadeGameRuntime({ children, gameId }: { children: ReactNode; gameId:string }) {
  const { pathname } = useLocation();
  const { lang, t } = useLanguage();
  const { announce } = useArcadeAccessibility();
  const runtime = useSyncExternalStore(gameManager.subscribe, gameManager.getSnapshot, gameManager.getSnapshot);
  const game = getArcadeGame(pathname)!;
  const playerData = usePlayerGameData(gameId);
  const [favorite, setFavorite] = useState(() => readFavoriteGames().includes(gameId));
  useEffect(() => {
    gameManager.start(gameId);
    announce(`${game.title} started.`);
    accessibilityAudio.announce(`${game.title} started.`, "instructions");
    return () => gameManager.stop();
  }, [announce, game.title, gameId]);
  useEffect(() => {
    const unlock = () => { void advancedAudioEngine.unlock().catch(() => undefined); };
    window.addEventListener("pointerdown", unlock, { once:true });
    window.addEventListener("keydown", unlock, { once:true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const paused = runtime.status === "paused";
  useEffect(() => {
    if (!paused) return;
    const swallow = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.altKey || event.ctrlKey || event.metaKey || event.key === "Tab") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-arcade-chrome]")) return;
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener("keydown", swallow, true);
    window.addEventListener("keyup", swallow, true);
    return () => {
      window.removeEventListener("keydown", swallow, true);
      window.removeEventListener("keyup", swallow, true);
    };
  }, [paused]);
  useEffect(() => {
    applyGraphicsProfile();
    const refresh = () => applyGraphicsProfile();
    window.addEventListener("visionex:arcade-settings", refresh);
    return () => window.removeEventListener("visionex:arcade-settings", refresh);
  }, []);
  const copy = localizeGame(game, lang, t);
  const release = gameReleaseInfo(game.slug);
  useDocumentHead({ title:`${copy.title} — Visionex Arcade`, description:copy.description, image:`${location.origin}${game.image}`, canonicalPath:game.to, structuredData:{ "@context":"https://schema.org", "@type":"VideoGame", name:copy.title, description:copy.description, url:`https://visionex.app${game.to}`, gamePlatform:"Web browser", playMode:game.players === "1" ? "SinglePlayer" : "MultiPlayer", accessibilityFeature:game.accessible ? ["keyboardControl","alternativeText","audioDescription"] : ["keyboardControl"] } });
  const similar = ARCADE_GAMES.filter((item) => item.slug !== game.slug && item.categories.some((category) => game.categories.includes(category))).slice(0, 3);

  return (
    <Layout>
      <div className="relative min-h-screen overflow-hidden bg-[#070914] text-white">
        <ArcadeVisual asset={visualForGame(game, "background")} className="arcade-game-background pointer-events-none absolute inset-x-0 top-0 h-[38rem] w-full object-cover opacity-20" loading="eager" fetchPriority="high" sizes="100vw" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-gradient-to-b from-[#070914]/35 via-[#070914]/85 to-[#070914]" aria-hidden="true" />
        <div className="section-container relative py-6 sm:py-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-slate-400">
            <Link to="/games" className="hover:text-white">Visionex Arcade</Link><ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /><span aria-current="page" className="text-slate-200">{copy.title}</span>
          </nav>
          <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">{game.categories.map((category) => <Badge key={category} variant="outline" className="border-violet-300/30 bg-violet-500/10 text-violet-100">{categoryLabel(t, category)}</Badge>)}</div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{copy.title}</h1>
              <p className="mt-2 max-w-2xl text-slate-300">{copy.description}</p>
            </div>
            <div data-arcade-chrome className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white" onClick={() => { const message = runtime.status === "paused" ? "Game resumed." : "Game paused."; if (runtime.status === "paused") gameManager.resume(); else gameManager.pause(); announce(message); accessibilityAudio.announce(message, "status"); }} aria-pressed={runtime.status === "paused"}>{runtime.status === "paused" ? <Play className="me-2 h-4 w-4" /> : <Pause className="me-2 h-4 w-4" />}{runtime.status === "paused" ? "Resume" : "Pause"}</Button>
              <Button variant="outline" className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white" onClick={() => { gameManager.restart(); announce("Game restarted.", "assertive"); accessibilityAudio.announce("Game restarted.", "instructions"); }}><RotateCcw className="me-2 h-4 w-4" />Restart</Button>
              <Button variant="outline" className="border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white" aria-pressed={favorite} onClick={() => setFavorite(toggleFavoriteGame(gameId).includes(gameId))}><Heart className={`me-2 h-4 w-4 ${favorite ? "fill-rose-400 text-rose-400" : ""}`} />{favorite ? "Saved" : "Favorite"}</Button>
              <GameSettingsPanel />
            </div>
          </header>

          <section aria-label={`${copy.title} game window`} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white text-foreground shadow-[0_24px_80px_rgba(0,0,0,.5)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-2 text-xs text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />Ready to play</span>
              <span>Visionex Arcade Secure Session</span>
            </div>
            <div className="relative min-h-[55vh]" aria-busy={runtime.status === "loading"}>
              <div className={paused ? "pointer-events-none select-none opacity-30" : ""} {...(paused ? { inert: "" } : {})}>
                {runtime.status === "loading" && <div className="arcade-loading absolute inset-0 z-20 grid place-items-center bg-slate-950 bg-cover bg-center text-white" style={{ backgroundImage:`linear-gradient(rgba(7,9,20,.42),rgba(7,9,20,.8)),url(${arcadeLoadingBackground})` }} role="status"><div className="text-center"><span className="arcade-loading__ring mx-auto block h-12 w-12 rounded-full border-4 border-white/20 border-t-cyan-300" aria-hidden="true" /><p className="mt-4 font-semibold">Loading game…</p></div></div>}
                <EmbeddedLayout><div key={runtime.revision}>{children}</div></EmbeddedLayout>
              </div>
              {paused && <div data-arcade-chrome data-arcade-paused className="absolute inset-0 z-30 grid place-items-center bg-slate-950/80 p-6 text-center text-white backdrop-blur-sm" role="dialog" aria-modal="false" aria-labelledby="arcade-paused-title"><div><Pause className="mx-auto h-10 w-10 text-cyan-300" aria-hidden="true" /><h2 id="arcade-paused-title" className="mt-3 text-2xl font-black">{lang === "ar" ? "اللعبة متوقفة مؤقتاً" : "Game paused"}</h2><p className="mt-2 text-sm text-slate-300">{lang === "ar" ? "لا يصل أي إدخال إلى اللعبة أثناء الإيقاف." : "No input reaches the game while it is paused."}</p><Button className="arcade-pressable mt-5" onClick={() => { gameManager.resume(); announce("Game resumed."); accessibilityAudio.announce("Game resumed.", "status"); }}><Play className="me-2 h-4 w-4" aria-hidden="true" />{lang === "ar" ? "متابعة" : "Resume"}</Button></div></div>}
              {runtime.status === "completed" && <div data-arcade-chrome data-arcade-result className="absolute inset-0 z-30 grid place-items-center bg-slate-950/90 p-6 text-center text-white backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="arcade-result-title"><div><Medal className="mx-auto h-12 w-12 text-amber-300" aria-hidden="true" /><h2 id="arcade-result-title" className="mt-3 text-2xl font-black">Round complete</h2><p className="mt-2 text-slate-300">Score: {runtime.score.toLocaleString(lang)}</p><Button className="arcade-pressable mt-5" onClick={() => gameManager.restart()}><RotateCcw className="me-2 h-4 w-4" />Play again</Button></div></div>}
            </div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_.55fr]">
            <section aria-labelledby="game-info-title" className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 id="game-info-title" className="flex items-center gap-2 text-xl font-bold"><Info className="h-5 w-5 text-violet-300" />{lang === "ar" ? "معلومات اللعبة" : "About this game"}</h2>
              <p className="mt-3 leading-7 text-slate-300">{copy.description}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoTile icon={Keyboard} label={lang === "ar" ? "التحكم" : "Controls"} value={game.controls.join(" · ")} />
                <InfoTile icon={Users} label={lang === "ar" ? "اللاعبون" : "Players"} value={game.players} />
                <InfoTile icon={BarChart3} label={t("games.difficulty.select")} value={difficultyLabel(t, game.difficulty)} />
                <InfoTile icon={Star} label={lang === "ar" ? "التقييم" : "User rating"} value={game.rating ? `${game.rating} / 5` : (lang === "ar" ? "لا توجد تقييمات بعد" : "Not rated yet")} />
              </div>
              <div className="mt-6 grid gap-5 border-t border-white/10 pt-6 md:grid-cols-2"><section aria-labelledby="how-to-play-title"><h3 id="how-to-play-title" className="font-black">{lang === "ar" ? "طريقة اللعب" : "How to play"}</h3><ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-300">{release.howToPlay.map(step=><li key={step}>{step}</li>)}</ol></section><section aria-labelledby="change-log-title"><h3 id="change-log-title" className="font-black">{lang === "ar" ? "سجل التغييرات" : "Change log"}</h3><p className="mt-1 text-xs text-cyan-300">v{release.version} · <time dateTime={release.updatedAt}>{release.updatedAt}</time></p><ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-slate-300">{release.changes.map(change=><li key={change}>{change}</li>)}</ul></section></div>
            </section>
            <aside aria-labelledby="game-stats-title" className="rounded-2xl border border-white/10 bg-gradient-to-b from-violet-500/15 to-white/5 p-6">
              <h2 id="game-stats-title" className="flex items-center gap-2 text-xl font-bold"><Medal className="h-5 w-5 text-amber-300" />{lang === "ar" ? "الإحصائيات" : "Game stats"}</h2>
              <dl className="mt-5 space-y-4">
                <Stat label={lang === "ar" ? "مرات اللعب على هذا الجهاز" : "Plays on this device"} value={playerData.playCount.toLocaleString(lang)} />
                <Stat label={lang === "ar" ? "أفضل نتيجة" : "Best score"} value={playerData.highScore.toLocaleString(lang)} />
                <Stat label={lang === "ar" ? "آخر نتيجة" : "Last score"} value={playerData.lastScore.toLocaleString(lang)} />
                <Stat label={lang === "ar" ? "وقت اللعب" : "Play time"} value={`${Math.round(playerData.totalPlaySeconds / 60)} min`} />
                <Stat label={lang === "ar" ? "أعلى مستوى" : "Highest level"} value={playerData.highestLevel ? playerData.highestLevel.toLocaleString(lang) : "—"} />
                <Stat label={lang === "ar" ? "الفئة العمرية" : "Age rating"} value={game.age} />
              </dl>
              <Button asChild variant="outline" className="mt-6 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link to="/leaderboard">{lang === "ar" ? "عرض لوحة الصدارة" : "View leaderboard"}</Link></Button>
              <div className="mt-6 border-t border-white/10 pt-5"><GameRating gameId={game.slug} /></div>
              <div className="mt-6 border-t border-white/10 pt-5"><h3 className="text-sm font-bold">{lang === "ar" ? "الإنجازات" : "Achievements"}</h3><ul className="mt-3 space-y-2">{ARCADE_ACHIEVEMENTS.slice(0,4).map((achievement) => { const unlocked = playerData.achievements.includes(achievement.id); return <li key={achievement.id} className={`flex items-center gap-2 text-xs ${unlocked ? "text-emerald-200" : "text-slate-500"}`}><Medal className="h-4 w-4" aria-hidden="true" /><span>{achievement.title}{unlocked ? " ✓" : ""}</span><span className="sr-only">{unlocked ? "Unlocked" : "Locked"}</span></li>; })}</ul></div>
            </aside>
          </div>

          <section aria-labelledby="similar-games-title" className="py-10">
            <h2 id="similar-games-title" className="mb-5 text-2xl font-black">{lang === "ar" ? "ألعاب مشابهة" : "Similar games"}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{similar.map((item) => <ArcadeGameCard key={item.slug} game={item} lang={lang} />)}</div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Gamepad2; label: string; value: string }) {
  return <div className="rounded-xl bg-black/20 p-4"><dt className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4" aria-hidden="true" />{label}</dt><dd className="mt-1 font-semibold text-white">{value}</dd></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0"><dt className="text-sm text-slate-400">{label}</dt><dd className="text-end text-sm font-bold text-white">{value}</dd></div>;
}
