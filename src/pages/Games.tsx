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
import arcadeHero from "@/features/arcade/assets/visionex-arcade-hero.webp";
import tournamentBanner from "@/assets/arcade/visionex-arcade-tournament-v1.webp";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { recommendGames } from "@/features/arcade/ai/ArcadeAI";
import { playerGameData } from "@/features/arcade/core/playerGameData";
import { readFavoriteGames } from "@/features/arcade/player/gamerProfile";
import { gameReleaseInfo } from "@/features/arcade/gameReleaseNotes";

type SectionProps = { title: string; eyebrow: string; games: typeof ARCADE_GAMES; lang: string };

const categoryLabelAr: Record<ArcadeCategory, string> = {
  Classic:"كلاسيكية", Puzzle:"ألغاز", Board:"لوحية", Card:"ورق", Educational:"تعليمية", Kids:"أطفال", Typing:"كتابة", Memory:"ذاكرة", Word:"كلمات", Math:"رياضيات", Logic:"منطق", Quiz:"اختبارات", Reaction:"سرعة استجابة", Arcade:"آركيد", Action:"أكشن", Adventure:"مغامرات", Platform:"منصات", Racing:"سباقات", Sports:"رياضة", Physics:"فيزياء", Simulation:"محاكاة", Idle:"خاملة", Strategy:"استراتيجية", "Tower Defense":"دفاع الأبراج", "City Builder":"بناء المدن", "Business Simulation":"محاكاة الأعمال", Cooking:"طبخ", Music:"موسيقى", Drawing:"رسم", Accessible:"ألعاب متاحة", Audio:"صوتية", Multiplayer:"متعددة اللاعبين",
};

export default function Games() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
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
    const copy = localizeGame(game, lang);
    const query = search.trim().toLocaleLowerCase(lang);
    return (!query || `${copy.title} ${copy.description}`.toLocaleLowerCase(lang).includes(query))
      && (category === "all" || game.categories.includes(category))
      && (age === "all" || game.age === age)
      && (difficulty === "all" || game.difficulty === difficulty)
      && (accessibility === "all" || game.accessible);
  }), [accessibility, age, category, difficulty, lang, search]);

  const filtersActive = search || category !== "all" || age !== "all" || difficulty !== "all" || accessibility !== "all";

  return (
    <Layout>
      <div className="min-h-screen bg-[#070914] text-white">
        <section className="relative isolate min-h-[560px] overflow-hidden border-b border-white/10">
          <img src={arcadeHero} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" width={1672} height={941} fetchPriority="high" decoding="async" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070914] via-[#070914]/85 to-[#070914]/15 rtl:bg-gradient-to-l" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#070914] via-transparent to-black/25" />
          <div className="section-container flex min-h-[560px] items-center py-16">
            <div className="max-w-2xl">
              <Badge className="mb-5 border border-violet-300/25 bg-violet-500/15 px-3 py-1.5 text-violet-100 backdrop-blur"><Sparkles className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "عالم اللعب الجديد" : "A new world of play"}</Badge>
              <div className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-[.24em] text-cyan-300"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-950"><Gamepad2 className="h-6 w-6" aria-hidden="true" /></span>Visionex Arcade</div>
              <h1 className="text-balance text-5xl font-black leading-[.95] tracking-tight sm:text-6xl lg:text-7xl">{ar ? "العب. تعلّم. وتصدّر." : "Play. Learn. Lead."}</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">{ar ? "ألعاب حديثة وتحديات ذكية وتجارب متاحة للجميع، داخل وجهة ترفيهية واحدة." : "Modern games, smart challenges, and accessible experiences—together in one premium destination."}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-violet-100"><a href="#featured"><Gamepad2 className="me-2 h-5 w-5" />{ar ? "استكشف الألعاب" : "Explore games"}</a></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/accessible"><Accessibility className="me-2 h-5 w-5" />{ar ? "الألعاب المتاحة" : "Accessible games"}</Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/kids"><Baby className="me-2 h-5 w-5" />Visionex Kids</Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-black/15 text-white backdrop-blur hover:bg-white/10 hover:text-white"><Link to="/games/profile"><UserRound className="me-2 h-5 w-5" />{ar ? "ملف اللاعب" : "Gamer profile"}</Link></Button>
                <GameSettingsPanel />
              </div>
              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
                <HeroStat icon={Gamepad2} value={String(ARCADE_GAMES.length)} label={ar ? "لعبة" : "games"} />
                <HeroStat icon={Users} value="1–2" label={ar ? "لاعبون" : "players"} />
                <HeroStat icon={ShieldCheck} value="AA" label={ar ? "تصميم متاح" : "accessible UI"} />
              </dl>
            </div>
          </div>
        </section>

        <main className="section-container py-10">
          <WatchAdButton variant="banner" className="mb-8" />
          <section aria-label={ar?"تحدي وبطولة اليوم":"Today’s challenge and tournament"} className="mb-8 grid gap-4 lg:grid-cols-2"><article className="relative isolate overflow-hidden rounded-3xl border border-amber-300/20 p-6"><img src={tournamentBanner} alt="" width={1672} height={941} loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover"/><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070914] via-[#070914]/85 to-[#070914]/30 rtl:bg-gradient-to-l"/><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{ar?"البطولة المميزة":"Featured Tournament"}</p><h2 className="mt-2 text-2xl font-black">Visionex Weekly Masters</h2><p className="mt-2 text-sm text-slate-200">{ar?"تظهر البطولة المباشرة بعد نشرها والتحقق من نتائجها خادمياً.":"Live entries appear only after the tournament is published and server verification is active."}</p><Button asChild className="mt-5"><Link to="/games/tournaments">{ar?"عرض البطولات":"View tournaments"}</Link></Button></article><article className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-transparent p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{ar?"تحدي اليوم":"Daily Challenge"}</p><h2 className="mt-2 text-2xl font-black">{ar?"أكمل ثلاث جولات":"Complete three rounds"}</h2><p className="mt-2 text-sm text-slate-300">{ar?"يُحتسب التقدم والمكافأة على الخادم بعد التحقق.":"Progress and rewards are calculated by the server after verification."}</p><Button asChild variant="outline" className="mt-5 border-white/20 bg-black/20 text-white hover:bg-white/10 hover:text-white"><Link to="/games/challenges">{ar?"عرض التحديات":"View challenges"}</Link></Button></article></section>

          <section aria-labelledby="discover-title" className="rounded-3xl border border-white/10 bg-white/[.04] p-4 shadow-2xl backdrop-blur sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{ar ? "اكتشف لعبتك" : "Find your next game"}</p><h2 id="discover-title" className="mt-1 text-2xl font-black">{ar ? "بحث وتصفية سريعة" : "Fast search & filters"}</h2></div>
              {filtersActive && <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => { setSearch(""); setCategory("all"); setAge("all"); setDifficulty("all"); setAccessibility("all"); }}>{ar ? "مسح الفلاتر" : "Clear filters"}</Button>}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2"><Label htmlFor="arcade-search" className="sr-only">{ar ? "ابحث عن لعبة" : "Search games"}</Label><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="arcade-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar ? "ابحث عن لعبة..." : "Search games..."} className="border-white/10 bg-black/30 ps-10 text-white placeholder:text-slate-500" /></div>
              <Filter value={category} onChange={(value) => setCategory(value as ArcadeCategory | "all")} label={ar ? "النوع" : "Category"} options={ARCADE_CATEGORIES.map((item) => ({ value:item, label:ar ? categoryLabelAr[item] : item }))} allLabel={ar ? "كل الأنواع" : "All categories"} />
              <Filter value={difficulty} onChange={(value) => setDifficulty(value as ArcadeDifficulty | "all")} label={ar ? "الصعوبة" : "Difficulty"} options={(["Easy","Medium","Hard"] as ArcadeDifficulty[]).map((item) => ({ value:item, label:item }))} allLabel={ar ? "كل المستويات" : "All levels"} />
              <Filter value={age} onChange={(value) => setAge(value as ArcadeAge | "all")} label={ar ? "العمر" : "Age"} options={(["Everyone","Kids","Teens"] as ArcadeAge[]).map((item) => ({ value:item, label:item }))} allLabel={ar ? "كل الأعمار" : "All ages"} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button size="sm" variant={accessibility === "accessible" ? "default" : "outline"} className={accessibility === "accessible" ? "" : "border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"} aria-pressed={accessibility === "accessible"} onClick={() => setAccessibility((value) => value === "all" ? "accessible" : "all")}><Accessibility className="me-2 h-4 w-4" />{ar ? "ميزات إمكانية الوصول" : "Accessibility features"}</Button>
              <p role="status" aria-live="polite" className="text-sm text-slate-400">{filtered.length} {ar ? "نتيجة" : "results"}</p>
            </div>
          </section>

          {filtersActive ? (
            <section aria-labelledby="results-title" className="py-12"><h2 id="results-title" className="mb-6 text-3xl font-black">{ar ? "نتائج البحث" : "Search results"}</h2>{filtered.length ? <PaginatedGameGrid games={filtered} lang={lang} /> : <div className="rounded-2xl border border-dashed border-white/15 py-20 text-center text-slate-400"><Search className="mx-auto mb-3 h-8 w-8" /><p>{ar ? "لم نجد ألعاباً تطابق هذه الفلاتر." : "No games match these filters."}</p></div>}</section>
          ) : (
            <>
              <GameSection title={ar ? "الألعاب المميزة" : "Featured Games"} eyebrow={ar ? "اختيارات المحررين" : "Editor’s picks"} games={ARCADE_GAMES.filter((game) => game.featured)} lang={lang} />
              {recentlyPlayed.length>0&&<GameSection title={ar?"تابع اللعب":"Continue Playing"} eyebrow={ar?"آخر جلساتك":"Your recent sessions"} games={recentlyPlayed} lang={lang}/>}
              {favorites.length>0&&<GameSection title={ar?"المفضلة":"Favorites"} eyebrow={ar?"الألعاب المحفوظة":"Saved games"} games={favorites} lang={lang}/>}
              <section aria-labelledby="arcade-ai-title" className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.04] p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Visionex Arcade AI</p><h2 id="arcade-ai-title" className="mt-1 text-3xl font-black">{ar ? "مقترحة لك" : "Recommended for you"}</h2><p className="mt-2 text-sm text-slate-400">{ar ? "اقتراحات قابلة للتفسير وتُحسب على جهازك دون إرسال بيانات شخصية." : "Explainable recommendations calculated on-device without sending personal data."}</p><div className="mt-5 grid gap-4 md:grid-cols-3">{aiRecommendations.map(item=><article key={item.game.slug} className="rounded-2xl bg-black/20 p-4"><h3 className="font-black">{localizeGame(item.game,lang).title}</h3><p className="mt-2 text-sm text-slate-300">{ar ? item.reason : "A balanced match for your play history and accessibility preferences."}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-cyan-300">{item.confidence}% match</span><Button asChild size="sm"><Link to={item.game.to}>{ar?"العب":"Play"}</Link></Button></div></article>)}</div></section>
              <GameSection title={ar ? "الرائج الآن" : "Trending Now"} eyebrow={ar ? "الأكثر لعباً" : "Most played"} games={ARCADE_GAMES.filter((game) => game.trending)} lang={lang} />
              <CategoryGrid lang={lang} onSelect={(item) => { setCategory(item); document.getElementById("discover-title")?.scrollIntoView({ behavior:"smooth", block:"start" }); }} />
              <GameSection title={ar ? "أضيفت حديثاً" : "Recently Added"} eyebrow={ar ? "جديد في Arcade" : "Fresh in the arcade"} games={ARCADE_GAMES.filter((game) => game.recentlyAdded)} lang={lang} />
              <GameSection title={ar?"حُدثت مؤخراً":"Recently Updated"} eyebrow={ar?"آخر تحسينات الجودة":"Latest quality updates"} games={recentlyUpdated} lang={lang}/>
              <div id="accessible"><GameSection title={ar ? "الألعاب المتاحة" : "Accessible Games"} eyebrow={ar ? "صُممت لتشمل الجميع" : "Designed for more players"} games={ARCADE_GAMES.filter((game) => game.accessible)} lang={lang} /></div>
              <section aria-labelledby="all-games-title" className="py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{ar?"المكتبة الكاملة":"Complete library"}</p><h2 id="all-games-title" className="mb-6 mt-1 text-3xl font-black">{ar?"كل الألعاب":"All Games"}</h2><PaginatedGameGrid games={ARCADE_GAMES} lang={lang}/></section>
            </>
          )}
          <AdBanner slot="3569383992" format="horizontal" className="mt-4" />
        </main>
      </div>
    </Layout>
  );
}

function GameSection({ title, eyebrow, games, lang }: SectionProps) {
  return <section id={title === "Featured Games" || title === "الألعاب المميزة" ? "featured" : undefined} aria-labelledby={`section-${games[0]?.slug}`} className="py-12"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">{eyebrow}</p><h2 id={`section-${games[0]?.slug}`} className="mt-1 text-3xl font-black">{title}</h2></div><Button asChild variant="ghost" className="hidden text-slate-300 hover:bg-white/10 hover:text-white sm:flex"><a href="#discover-title">{lang === "ar" ? "عرض الكل" : "View all"}<ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" /></a></Button></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{games.slice(0, 4).map((game, index) => <ArcadeGameCard key={game.slug} game={game} lang={lang} priority={index === 0} />)}</div></section>;
}

function PaginatedGameGrid({games,lang}:{games:typeof ARCADE_GAMES;lang:string}) {
  const [visible,setVisible]=useState(24);
  const signature=games.map(game=>game.slug).join("|");
  useEffect(()=>setVisible(24),[signature]);
  return <><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{games.slice(0,visible).map((game,index)=><ArcadeGameCard key={game.slug} game={game} lang={lang} priority={index<4}/>)}</div>{visible<games.length&&<div className="mt-8 text-center"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={()=>setVisible(count=>count+24)}>{lang==="ar"?"عرض المزيد":"Show more"}<span className="ms-2 text-xs text-slate-400">{Math.min(24,games.length-visible)}</span></Button></div>}</>;
}

function CategoryGrid({ lang, onSelect }: { lang: string; onSelect:(item:ArcadeCategory)=>void }) {
  return <section aria-labelledby="categories-title" className="py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{lang === "ar" ? "لكل أسلوب لعب" : "Every way to play"}</p><h2 id="categories-title" className="mb-6 mt-1 text-3xl font-black">{lang === "ar" ? "التصنيفات" : "Categories"}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ARCADE_CATEGORIES.map((item) => <button type="button" key={item} onClick={() => onSelect(item)} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.08] to-transparent p-5 text-start transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><span><span className="block text-lg font-bold">{lang === "ar" ? categoryLabelAr[item] : item}</span><span className="mt-1 block text-xs text-slate-400">{ARCADE_GAMES.filter((game) => game.categories.includes(item)).length} {lang === "ar" ? "ألعاب" : "games"}</span></span>{item === "Accessible" ? <Accessibility className="h-6 w-6 text-cyan-300" /> : item === "Multiplayer" ? <Users className="h-6 w-6 text-violet-300" /> : item === "Strategy" ? <Trophy className="h-6 w-6 text-amber-300" /> : <Gamepad2 className="h-6 w-6 text-violet-300" />}</button>)}</div></section>;
}

function Filter({ value, onChange, label, allLabel, options }: { value:string; onChange:(value:string)=>void; label:string; allLabel:string; options:{ value:string; label:string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="border-white/10 bg-black/30 text-white"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">{allLabel}</SelectItem>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>;
}

function HeroStat({ icon: Icon, value, label }: { icon: typeof Gamepad2; value:string; label:string }) {
  return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-violet-300" aria-hidden="true" /><dt className="sr-only">{label}</dt><dd><strong className="text-white">{value}</strong> {label}</dd></div>;
}
