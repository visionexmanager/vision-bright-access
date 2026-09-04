import { useEffect, useMemo, useState } from "react";
import { Accessibility, ArrowRight, Baby, Gamepad2, Search, ShieldCheck, Sparkles, Trophy, UserRound, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdBanner } from "@/components/AdBanner";
import { WatchAdButton } from "@/components/WatchAdButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { GameSettingsPanel } from "@/features/arcade/GameSettingsPanel";
import { ArcadeGameCard } from "@/features/arcade/ArcadeGameCard";
import { ARCADE_CATEGORIES, ARCADE_GAMES, type ArcadeAge, type ArcadeCategory, type ArcadeDifficulty, localizeGame } from "@/features/arcade/catalog";
import { ageLabel, categoryLabel, difficultyLabel } from "@/features/arcade/labels";
import arcadeHero from "@/features/arcade/assets/visionex-arcade-hero.webp";
import tournamentBanner from "@/assets/arcade/visionex-arcade-tournament-v1.webp";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { recommendGames } from "@/features/arcade/ai/ArcadeAI";
import { playerGameData } from "@/features/arcade/core/playerGameData";
import { readFavoriteGames } from "@/features/arcade/player/gamerProfile";
import { gameReleaseInfo } from "@/features/arcade/gameReleaseNotes";

// The anchor is the section id, not its heading text: the hero links to
// #featured, and matching on a translated title only ever worked in English
// and Arabic.
type SectionProps = { id: string; title: string; eyebrow: string; games: typeof ARCADE_GAMES; lang: string };


export default function Games() {
  const { lang, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ArcadeCategory | "all">("all");
  const [age, setAge] = useState<ArcadeAge | "all">("all");
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty | "all">("all");
  const [accessibility, setAccessibility] = useState<"all" | "accessible">("all");
  useDocumentHead({ title:"Visionex Arcade — Accessible Games, Challenges & Tournaments", description:"Play accessible, educational and competitive browser games in Visionex Arcade.", image:`${location.origin}${arcadeHero}`, canonicalPath:"/games", structuredData:{ "@context":"https://schema.org", "@type":"CollectionPage", name:"Visionex Arcade", url:"https://visionex.app/games", numberOfItems:ARCADE_GAMES.length } });
  const aiRecommendations = useMemo(() => recommendGames(ARCADE_GAMES, new Map(ARCADE_GAMES.map((game) => [game.slug, playerGameData.get(game.slug)]))), []);
  const recentlyPlayed = useMemo(() => ARCADE_GAMES.filter(game=>playerGameData.get(game.slug).lastPlayedAt).sort((a,b)=>String(playerGameData.get(b.slug).lastPlayedAt).localeCompare(String(playerGameData.get(a.slug).lastPlayedAt))).slice(0,4),[]);
  const favorites = useMemo(() => { const ids=new Set(readFavoriteGames()); return ARCADE_GAMES.filter(game=>ids.has(game.slug)).slice(0,4); },[]);
  const recentlyUpdated = useMemo(() => [...ARCADE_GAMES].sort((a,b)=>gameReleaseInfo(b.slug).updatedAt.localeCompare(gameReleaseInfo(a.slug).updatedAt)).slice(0,4),[]);

  const filtered = useMemo(() => ARCADE_GAMES.filter((game) => {
    const copy = localizeGame(game, lang, t);
    const query = search.trim().toLocaleLowerCase(lang);
    return (!query || `${copy.title} ${copy.description}`.toLocaleLowerCase(lang).includes(query))
      && (category === "all" || game.categories.includes(category))
      && (age === "all" || game.age === age)
      && (difficulty === "all" || game.difficulty === difficulty)
      && (accessibility === "all" || game.accessible);
  }), [accessibility, age, category, difficulty, lang, search, t]);

  const filtersActive = search || category !== "all" || age !== "all" || difficulty !== "all" || accessibility !== "all";

  return (
    <Layout>
      <div className="min-h-screen bg-[#070914] text-white">
        <section className="relative isolate min-h-[560px] overflow-hidden border-b border-white/10">
          <img src={arcadeHero} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" width={1672} height={941} {...{ fetchpriority: "high" }} decoding="async" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070914] via-[#070914]/85 to-[#070914]/15 rtl:bg-gradient-to-l" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#070914] via-transparent to-black/25" />
          <div className="section-container flex min-h-[560px] items-center py-16">
            <div className="max-w-2xl">
              <Badge className="mb-5 border border-violet-300/25 bg-violet-500/15 px-3 py-1.5 text-violet-100 backdrop-blur"><Sparkles className="me-2 h-4 w-4" aria-hidden="true" />{t("games.arcade.hero.badge")}</Badge>
              <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-[.24em] text-cyan-300"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-950"><Gamepad2 className="h-6 w-6" aria-hidden="true" /></span>Visionex Arcade</div>
              <h1 className="text-balance text-5xl font-black leading-[.95] tracking-tight sm:text-6xl lg:text-7xl">{t("games.arcade.hero.title")}</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">{t("games.arcade.hero.subtitle")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-violet-100"><a href="#featured"><Gamepad2 className="me-2 h-5 w-5" />{t("games.arcade.hero.explore")}</a></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/accessible"><Accessibility className="me-2 h-5 w-5" />{t("games.arcade.hero.accessible")}</Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/kids"><Baby className="me-2 h-5 w-5" />Visionex Kids</Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/profile"><UserRound className="me-2 h-5 w-5" />{t("games.arcade.hero.profile")}</Link></Button>
                <GameSettingsPanel />
              </div>
              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
                <HeroStat icon={Gamepad2} value={String(ARCADE_GAMES.length)} label={t("games.arcade.hero.statGames")} />
                <HeroStat icon={Users} value="1–2" label={t("games.arcade.hero.statPlayers")} />
                <HeroStat icon={ShieldCheck} value="AA" label={t("games.arcade.hero.statAccessible")} />
              </dl>
            </div>
          </div>
        </section>

        <main className="section-container py-10">
          <WatchAdButton variant="banner" className="mb-8" />
          <section aria-label={t("games.arcade.today.label")} className="mb-8 grid gap-4 lg:grid-cols-2"><article className="relative isolate overflow-hidden rounded-3xl border border-amber-300/20 p-6"><img src={tournamentBanner} alt="" width={1672} height={941} loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover"/><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070914] via-[#070914]/85 to-[#070914]/30 rtl:bg-gradient-to-l"/><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{t("games.arcade.tournament.eyebrow")}</p><h2 className="mt-2 text-2xl font-black">Visionex Weekly Masters</h2><p className="mt-2 text-sm text-slate-200">{t("games.arcade.tournament.note")}</p><Button asChild className="mt-5"><Link to="/games/tournaments">{t("games.arcade.tournament.cta")}</Link></Button></article><article className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-transparent p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{t("games.arcade.challenge.eyebrow")}</p><h2 className="mt-2 text-2xl font-black">{t("games.arcade.challenge.title")}</h2><p className="mt-2 text-sm text-slate-300">{t("games.arcade.challenge.note")}</p><Button asChild variant="outline" className="mt-5 border-white/20 bg-black/20 text-white hover:bg-white/10 hover:text-white"><Link to="/games/challenges">{t("games.arcade.challenge.cta")}</Link></Button></article></section>

          <section aria-labelledby="discover-title" className="rounded-3xl border border-white/10 bg-white/[.04] p-4 shadow-2xl backdrop-blur sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{t("games.arcade.discover.eyebrow")}</p><h2 id="discover-title" className="mt-1 text-2xl font-black">{t("games.arcade.discover.title")}</h2></div>
              {filtersActive && <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => { setSearch(""); setCategory("all"); setAge("all"); setDifficulty("all"); setAccessibility("all"); }}>{t("games.arcade.discover.clear")}</Button>}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2"><Label htmlFor="arcade-search" className="sr-only">{t("games.arcade.discover.searchLabel")}</Label><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="arcade-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("games.searchPlaceholder")} className="border-white/10 bg-black/30 ps-10 text-white placeholder:text-slate-500" /></div>
              <Filter value={category} onChange={(value) => setCategory(value as ArcadeCategory | "all")} label={t("games.filter.category")} options={ARCADE_CATEGORIES.map((item) => ({ value:item, label:categoryLabel(t, item) }))} allLabel={t("games.filter.allCategories")} />
              <Filter value={difficulty} onChange={(value) => setDifficulty(value as ArcadeDifficulty | "all")} label={t("games.difficulty.select")} options={(["Easy","Medium","Hard"] as ArcadeDifficulty[]).map((item) => ({ value:item, label:difficultyLabel(t, item) }))} allLabel={t("games.filter.allLevels")} />
              <Filter value={age} onChange={(value) => setAge(value as ArcadeAge | "all")} label={t("games.filter.age")} options={(["Everyone","Kids","Teens"] as ArcadeAge[]).map((item) => ({ value:item, label:ageLabel(t, item) }))} allLabel={t("games.filter.allAges")} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button size="sm" variant={accessibility === "accessible" ? "default" : "outline"} className={accessibility === "accessible" ? "" : "border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"} aria-pressed={accessibility === "accessible"} onClick={() => setAccessibility((value) => value === "all" ? "accessible" : "all")}><Accessibility className="me-2 h-4 w-4" />{t("games.arcade.discover.accessibilityFilter")}</Button>
              <p role="status" aria-live="polite" className="text-sm text-slate-400">{t("games.arcade.results.count").replace("{count}", String(filtered.length))}</p>
            </div>
          </section>

          {filtersActive ? (
            <section aria-labelledby="results-title" className="py-12"><h2 id="results-title" className="mb-6 text-3xl font-black">{t("games.arcade.results.title")}</h2>{filtered.length ? <PaginatedGameGrid games={filtered} lang={lang} /> : <div className="rounded-2xl border border-dashed border-white/15 py-20 text-center text-slate-400"><Search className="mx-auto mb-3 h-8 w-8" /><p>{t("games.arcade.results.empty")}</p></div>}</section>
          ) : (
            <>
              <GameSection id="featured" title={t("games.arcade.section.featured")} eyebrow={t("games.arcade.section.featuredEyebrow")} games={ARCADE_GAMES.filter((game) => game.featured)} lang={lang} />
              {recentlyPlayed.length>0&&<GameSection id="continue-playing" title={t("games.arcade.section.continue")} eyebrow={t("games.arcade.section.continueEyebrow")} games={recentlyPlayed} lang={lang}/>}
              {favorites.length>0&&<GameSection id="favorites" title={t("games.arcade.section.favorites")} eyebrow={t("games.arcade.section.favoritesEyebrow")} games={favorites} lang={lang}/>}
              <section aria-labelledby="arcade-ai-title" className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.04] p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Visionex Arcade AI</p><h2 id="arcade-ai-title" className="mt-1 text-3xl font-black">{t("games.arcade.ai.title")}</h2><p className="mt-2 text-sm text-slate-400">{t("games.arcade.ai.note")}</p><div className="mt-5 grid gap-4 md:grid-cols-3">{aiRecommendations.map(item=><article key={item.game.slug} className="rounded-2xl bg-black/20 p-4"><h3 className="font-black">{localizeGame(item.game,lang,t).title}</h3><p className="mt-2 text-sm text-slate-300">{t(item.reasonKey)}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-cyan-300">{t("games.arcade.ai.match").replace("{percent}", String(item.confidence))}</span><Button asChild size="sm"><Link to={item.game.to}>{t("games.arcade.ai.play")}</Link></Button></div></article>)}</div></section>
              <GameSection id="trending" title={t("games.arcade.section.trending")} eyebrow={t("games.arcade.section.trendingEyebrow")} games={ARCADE_GAMES.filter((game) => game.trending)} lang={lang} />
              <CategoryGrid onSelect={(item) => { setCategory(item); document.getElementById("discover-title")?.scrollIntoView({ behavior:"smooth", block:"start" }); }} />
              <GameSection id="recently-added" title={t("games.arcade.section.recentlyAdded")} eyebrow={t("games.arcade.section.recentlyAddedEyebrow")} games={ARCADE_GAMES.filter((game) => game.recentlyAdded)} lang={lang} />
              <GameSection id="recently-updated" title={t("games.arcade.section.recentlyUpdated")} eyebrow={t("games.arcade.section.recentlyUpdatedEyebrow")} games={recentlyUpdated} lang={lang}/>
              <GameSection id="accessible" title={t("games.arcade.section.accessible")} eyebrow={t("games.arcade.section.accessibleEyebrow")} games={ARCADE_GAMES.filter((game) => game.accessible)} lang={lang} />
              <section aria-labelledby="all-games-title" className="py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{t("games.arcade.library.eyebrow")}</p><h2 id="all-games-title" className="mb-6 mt-1 text-3xl font-black">{t("games.arcade.library.title")}</h2><PaginatedGameGrid games={ARCADE_GAMES} lang={lang}/></section>
            </>
          )}
          <AdBanner slot="3569383992" format="horizontal" className="mt-4" />
        </main>
      </div>
    </Layout>
  );
}

function GameSection({ id, title, eyebrow, games, lang }: SectionProps) {
  const { t } = useLanguage();
  return <section id={id} aria-labelledby={`${id}-title`} className="py-12"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">{eyebrow}</p><h2 id={`${id}-title`} className="mt-1 text-3xl font-black">{title}</h2></div><Button asChild variant="ghost" className="hidden text-slate-300 hover:bg-white/10 hover:text-white sm:flex"><a href="#discover-title">{t("games.arcade.section.viewAll")}<ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" /></a></Button></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{games.slice(0, 4).map((game, index) => <ArcadeGameCard key={game.slug} game={game} lang={lang} priority={index === 0} />)}</div></section>;
}

function PaginatedGameGrid({games,lang}:{games:typeof ARCADE_GAMES;lang:string}) {
  const { t } = useLanguage();
  const [visible,setVisible]=useState(24);
  const signature=games.map(game=>game.slug).join("|");
  useEffect(()=>setVisible(24),[signature]);
  return <><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{games.slice(0,visible).map((game,index)=><ArcadeGameCard key={game.slug} game={game} lang={lang} priority={index<4}/>)}</div>{visible<games.length&&<div className="mt-8 text-center"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={()=>setVisible(count=>count+24)}>{t("games.arcade.showMore")}<span className="ms-2 text-xs text-slate-400">{Math.min(24,games.length-visible)}</span></Button></div>}</>;
}

function CategoryGrid({ onSelect }: { onSelect:(item:ArcadeCategory)=>void }) {
  const { t } = useLanguage();
  return <section aria-labelledby="categories-title" className="py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{t("games.arcade.categories.eyebrow")}</p><h2 id="categories-title" className="mb-6 mt-1 text-3xl font-black">{t("games.arcade.categories.title")}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ARCADE_CATEGORIES.map((item) => <button type="button" key={item} onClick={() => onSelect(item)} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.08] to-transparent p-5 text-start transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><span><span className="block text-lg font-bold">{categoryLabel(t, item)}</span><span className="mt-1 block text-xs text-slate-400">{t("games.arcade.categories.count").replace("{count}", String(ARCADE_GAMES.filter((game) => game.categories.includes(item)).length))}</span></span>{item === "Accessible" ? <Accessibility className="h-6 w-6 text-cyan-300" /> : item === "Multiplayer" ? <Users className="h-6 w-6 text-violet-300" /> : item === "Strategy" ? <Trophy className="h-6 w-6 text-amber-300" /> : <Gamepad2 className="h-6 w-6 text-violet-300" />}</button>)}</div></section>;
}

function Filter({ value, onChange, label, allLabel, options }: { value:string; onChange:(value:string)=>void; label:string; allLabel:string; options:{ value:string; label:string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="border-white/10 bg-black/30 text-white"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{allLabel}</SelectItem>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>;
}

function HeroStat({ icon: Icon, value, label }: { icon: typeof Gamepad2; value:string; label:string }) {
  return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-violet-300" aria-hidden="true" /><dt className="sr-only">{label}</dt><dd><strong className="text-white">{value}</strong> {label}</dd></div>;
}
