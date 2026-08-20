import { Brain, Eye, Gamepad2, Lightbulb, Palette, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArcadeGameCard } from "@/features/arcade/ArcadeGameCard";
import { ARCADE_GAMES } from "@/features/arcade/catalog";
import { ParentDashboard } from "@/features/arcade/kids/ParentDashboard";
import hero from "@/assets/arcade/kids/visionex-kids-hero.webp";

export default function VisionexKids() {
  const { lang } = useLanguage(); const ar = lang === "ar";
  const kids = ARCADE_GAMES.filter((game) => game.age === "Kids" || game.categories.includes("Kids"));
  const learning = ARCADE_GAMES.filter((game) => game.categories.includes("Educational") && !kids.includes(game));
  return <Layout><div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-violet-50 text-slate-950">
    <section className="relative isolate min-h-[520px] overflow-hidden border-b border-sky-200"><img src={hero} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" width={1672} height={941} {...{ fetchpriority: "high" }} decoding="async" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-sky-50 via-sky-50/90 to-transparent rtl:bg-gradient-to-l" /><div className="section-container flex min-h-[520px] items-center py-14"><div className="max-w-xl"><Badge className="bg-violet-700 text-white"><Sparkles className="me-2 h-4 w-4" />Visionex Kids</Badge><h1 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">{ar ? "نتعلم باللعب" : "Learn through play"}</h1><p className="mt-5 text-lg leading-8 text-slate-700">{ar ? "ألعاب ذاكرة وذكاء ومهارات وإبداع بواجهة واضحة وممتعة للأطفال." : "Memory, thinking, skills, and creativity games in a clear and welcoming space for children."}</p><div className="mt-6 flex flex-wrap gap-2 text-sm"><Pill icon={Eye} text={ar ? "تباين واضح" : "Clear contrast"} /><Pill icon={Gamepad2} text={ar ? "كيبورد ولمس" : "Keyboard & touch"} /><Pill icon={ShieldCheck} text={ar ? "خصوصية محلية" : "Local privacy"} /></div></div></div></section>
    <main className="section-container space-y-14 py-12"><section aria-labelledby="kids-paths"><h2 id="kids-paths" className="text-3xl font-black">{ar ? "مسارات التعلم" : "Learning paths"}</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Path icon={Brain} title={ar ? "الذاكرة والذكاء" : "Memory & thinking"} /><Path icon={Lightbulb} title={ar ? "حل المشكلات" : "Problem solving"} /><Path icon={Palette} title={ar ? "الإبداع" : "Creativity"} /><Path icon={Star} title={ar ? "مهارات جديدة" : "New skills"} /></div></section>
      <GameGrid title={ar ? "ألعاب الأطفال" : "Kids games"} games={kids} lang={lang} />
      <GameGrid title={ar ? "ألعاب تعليمية" : "Educational games"} games={learning} lang={lang} />
      <ParentDashboard ar={ar} />
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black">{ar ? "ألعاب قيد الإنتاج" : "Games in production"}</h2><p className="mt-2 text-sm leading-6 text-amber-950">{ar ? "تعلم الحروف والأرقام والألوان والأشكال والمطابقة مسجلة في خطة الإنتاج، ولن تُنشر قبل اكتمال النطق البشري الطبيعي واختبارات العمر وإمكانية الوصول." : "Letters, numbers, colors, shapes, and matching are registered in production and will not publish before natural human narration, age review, and accessibility testing are complete."}</p></section>
    </main></div></Layout>;
}

function GameGrid({ title, games, lang }: { title:string; games:typeof ARCADE_GAMES; lang:string }) { return <section><h2 className="text-3xl font-black">{title}</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => <ArcadeGameCard key={game.slug} game={game} lang={lang} />)}</div></section>; }
function Path({ icon:Icon, title }: { icon:typeof Brain; title:string }) { return <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm"><Icon className="h-7 w-7 text-violet-700" /><h3 className="mt-3 font-black">{title}</h3></div>; }
function Pill({ icon:Icon, text }: { icon:typeof Eye; text:string }) { return <span className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 font-semibold shadow-sm"><Icon className="h-4 w-4 text-violet-700" />{text}</span>; }
