import { useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { BookOpen, Blocks, Heart, RotateCcw, Rocket, Star } from "lucide-react";

function useFinish(label: string) {
  const { settleGameResult } = useGameEconomy();
  const finished = useRef(false);
  return (won: boolean) => {
    if (finished.current) return;
    finished.current = true;
    void settleGameResult(won ? "win" : "loss", label);
  };
}

function GameHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-violet-950 via-indigo-900 to-cyan-800 p-7 text-center text-white shadow-xl">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">{icon}</div>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-cyan-50 sm:text-base">{subtitle}</p>
    </div>
  );
}

type Move = "jump" | "duck" | "run";
const COURSE: { move: Move; icon: string; en: string; ar: string }[] = [
  { move: "jump", icon: "🪨", en: "Rock ahead", ar: "صخرة أمامك" },
  { move: "run", icon: "⭐", en: "Collect the star", ar: "اجمع النجمة" },
  { move: "duck", icon: "🌿", en: "Low branch", ar: "غصن منخفض" },
  { move: "jump", icon: "🌊", en: "Stream ahead", ar: "جدول ماء أمامك" },
  { move: "run", icon: "💎", en: "Collect the crystal", ar: "اجمع البلورة" },
  { move: "duck", icon: "🦋", en: "Butterfly tunnel", ar: "نفق الفراشات" },
  { move: "jump", icon: "🪵", en: "Fallen log", ar: "جذع شجرة" },
  { move: "run", icon: "🔑", en: "Take the sky key", ar: "خذ مفتاح السماء" },
  { move: "duck", icon: "☁️", en: "Cloud arch", ar: "قوس السحاب" },
  { move: "jump", icon: "🏁", en: "Leap to the finish", ar: "اقفز إلى النهاية" },
];

export function SkyboundQuest() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const finish = useFinish("Skybound Quest");
  const [step, setStep] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState(ar ? "ابدأ المغامرة." : "Begin the adventure.");
  const done = step >= COURSE.length || lives <= 0;
  const choose = (move: Move) => {
    if (done) return;
    if (COURSE[step].move === move) {
      const next = step + 1;
      setStep(next);
      setScore((value) => value + 100);
      playSound(next === COURSE.length ? "complete" : "points");
      setStatus(next === COURSE.length ? (ar ? "فزت ووصلت إلى بوابة السماء!" : "You won and reached the Sky Gate!") : (ar ? "حركة صحيحة!" : "Great move!"));
      if (next === COURSE.length) finish(true);
    } else {
      const nextLives = lives - 1;
      setLives(nextLives);
      playSound("error");
      setStatus(ar ? "حاول حركة مختلفة." : "Try a different move.");
      if (nextLives === 0) finish(false);
    }
  };
  const restart = () => { setStep(0); setLives(3); setScore(0); setStatus(ar ? "بدأت لعبة جديدة." : "New run started."); };
  return (
    <Layout><section className="section-container max-w-4xl py-10">
      <GameHeader icon={<Rocket className="h-9 w-9" />} title={ar ? "مغامرة بوابة السماء" : "Skybound Quest"} subtitle={ar ? "مغامرة منصات أصلية: اختر القفز أو الانخفاض أو الركض واجمع الكنوز." : "An original platform adventure: jump, duck, or run to collect treasures."} />
      <div className="mb-4 flex flex-wrap justify-center gap-3" aria-label={ar ? "حالة اللعبة" : "Game status"}>
        <Badge><Heart className="me-1 h-4 w-4" />{lives}</Badge><Badge variant="secondary"><Star className="me-1 h-4 w-4" />{score}</Badge><Badge variant="outline">{step}/{COURSE.length}</Badge>
      </div>
      <Card className="overflow-hidden border-cyan-500/30">
        <CardContent className="p-6 text-center">
          {!done ? <><div className="mb-3 text-8xl" aria-hidden="true">{COURSE[step].icon}</div><h2 className="text-2xl font-bold">{ar ? COURSE[step].ar : COURSE[step].en}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Button size="lg" onClick={() => choose("jump")}>⬆️ {ar ? "اقفز" : "Jump"}</Button>
            <Button size="lg" variant="secondary" onClick={() => choose("duck")}>⬇️ {ar ? "انخفض" : "Duck"}</Button>
            <Button size="lg" variant="outline" onClick={() => choose("run")}>➡️ {ar ? "اركض" : "Run"}</Button>
          </div></> : <Button size="lg" onClick={restart}><RotateCcw className="me-2" />{ar ? "العب مجددًا" : "Play again"}</Button>}
          <p className="mt-5 rounded-lg bg-muted p-3 font-medium" role="status" aria-live="polite">{status}</p>
        </CardContent>
      </Card>
    </section></Layout>
  );
}

type Block = "empty" | "grass" | "water" | "tree" | "home";
const BLOCKS: Record<Block, string> = { empty: "＋", grass: "🟩", water: "🟦", tree: "🌳", home: "🏠" };

export function BuildWorldKids() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const finish = useFinish("BuildWorld Kids");
  const [selected, setSelected] = useState<Block>("grass");
  const [world, setWorld] = useState<Block[]>(() => Array(36).fill("empty"));
  const [status, setStatus] = useState(ar ? "ابنِ قرية صديقة للطبيعة." : "Build an eco-friendly village.");
  const counts = useMemo(() => world.reduce<Record<Block, number>>((all, block) => ({ ...all, [block]: all[block] + 1 }), { empty: 0, grass: 0, water: 0, tree: 0, home: 0 }), [world]);
  const place = (index: number) => {
    setWorld((current) => current.map((block, cell) => cell === index ? selected : block));
    playSound("click");
    setStatus(ar ? `تم وضع ${BLOCKS[selected]} في الخانة ${index + 1}.` : `Placed ${selected} in cell ${index + 1}.`);
  };
  const check = () => {
    const won = counts.home >= 2 && counts.tree >= 4 && counts.water >= 3 && counts.grass >= 6;
    playSound(won ? "complete" : "error");
    setStatus(won ? (ar ? "أحسنت! بنيت قرية آمنة ومتوازنة." : "Great work! You built a safe, balanced village.") : (ar ? "تحتاج منزلين و4 أشجار و3 مياه و6 مساحات خضراء." : "You need 2 homes, 4 trees, 3 water blocks, and 6 grass blocks."));
    if (won) finish(true);
  };
  return (
    <Layout><section className="section-container max-w-5xl py-10">
      <GameHeader icon={<Blocks className="h-9 w-9" />} title={ar ? "عالم البناء الآمن للأطفال" : "BuildWorld Kids"} subtitle={ar ? "عالم بناء خاص بلا دردشة أو إعلانات أو محتوى من الغرباء." : "A private building world with no chat, ads, strangers, or user-generated content."} />
      <Card><CardHeader><CardTitle>{ar ? "المهمة: قرية خضراء" : "Mission: Green Village"}</CardTitle></CardHeader><CardContent>
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={ar ? "اختر قطعة بناء" : "Choose a block"}>
          {(["grass","water","tree","home"] as Block[]).map((block) => <Button key={block} variant={selected === block ? "default" : "outline"} aria-pressed={selected === block} onClick={() => setSelected(block)}>{BLOCKS[block]} {ar ? ({grass:"عشب",water:"ماء",tree:"شجرة",home:"منزل"} as Record<Block,string>)[block] : block}</Button>)}
        </div>
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1 rounded-xl bg-emerald-950 p-2" role="grid" aria-label={ar ? "شبكة البناء 6 في 6" : "6 by 6 build grid"}>
          {world.map((block, index) => <button key={index} type="button" role="gridcell" aria-label={ar ? `الخانة ${index + 1}: ${block}` : `Cell ${index + 1}: ${block}`} onClick={() => place(index)} className="aspect-square rounded-md bg-white text-2xl shadow focus:outline-none focus:ring-4 focus:ring-amber-400">{BLOCKS[block]}</button>)}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2"><Badge>🏠 {counts.home}/2</Badge><Badge>🌳 {counts.tree}/4</Badge><Badge>🟦 {counts.water}/3</Badge><Badge>🟩 {counts.grass}/6</Badge></div>
        <div className="mt-5 flex justify-center gap-3"><Button size="lg" onClick={check}>{ar ? "افحص القرية" : "Check village"}</Button><Button variant="outline" onClick={() => { setWorld(Array(36).fill("empty")); setStatus(ar ? "تم مسح العالم." : "World cleared."); }}><RotateCcw className="me-2" />{ar ? "مسح" : "Clear"}</Button></div>
        <p className="mt-4 rounded-lg bg-muted p-3 text-center" role="status" aria-live="polite">{status}</p>
      </CardContent></Card>
    </section></Layout>
  );
}

const QUESTIONS = [
  { en: "What planet is known as the Red Planet?", ar: "أي كوكب يُعرف بالكوكب الأحمر؟", options: ["Earth","Mars","Venus"], optionsAr: ["الأرض","المريخ","الزهرة"], answer: 1 },
  { en: "What is 9 × 7?", ar: "كم يساوي 9 × 7؟", options: ["56","63","72"], optionsAr: ["56","63","72"], answer: 1 },
  { en: "Which gas do plants absorb?", ar: "أي غاز تمتصه النباتات؟", options: ["Oxygen","Carbon dioxide","Hydrogen"], optionsAr: ["الأكسجين","ثاني أكسيد الكربون","الهيدروجين"], answer: 1 },
  { en: "How many continents are there?", ar: "كم عدد القارات؟", options: ["5","6","7"], optionsAr: ["5","6","7"], answer: 2 },
  { en: "Which word is a verb?", ar: "أي كلمة هي فعل؟", options: ["Run","Blue","Table"], optionsAr: ["يركض","أزرق","طاولة"], answer: 0 },
  { en: "What is half of 144?", ar: "ما نصف 144؟", options: ["62","72","74"], optionsAr: ["62","72","74"], answer: 1 },
];

export function KnowledgeGalaxy() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { playSound } = useSound();
  const finish = useFinish("Knowledge Galaxy");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState(ar ? "اختر الإجابة الصحيحة." : "Choose the correct answer.");
  const done = index >= QUESTIONS.length;
  const answer = (choice: number) => {
    const correct = choice === QUESTIONS[index].answer;
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore);
    playSound(correct ? "success" : "error");
    const next = index + 1;
    setIndex(next);
    if (next === QUESTIONS.length) {
      const won = nextScore >= 4;
      setStatus(won ? (ar ? `أحسنت! نتيجتك ${nextScore} من 6.` : `Well done! You scored ${nextScore} of 6.`) : (ar ? `نتيجتك ${nextScore} من 6. حاول مرة أخرى.` : `You scored ${nextScore} of 6. Try again.`));
      finish(won);
    } else setStatus(correct ? (ar ? "إجابة صحيحة!" : "Correct!") : (ar ? "ليست صحيحة، تابع التعلم." : "Not quite—keep learning."));
  };
  return (
    <Layout><section className="section-container max-w-3xl py-10">
      <GameHeader icon={<BookOpen className="h-9 w-9" />} title={ar ? "مجرة المعرفة" : "Knowledge Galaxy"} subtitle={ar ? "أسئلة قصيرة في العلوم والرياضيات واللغة والجغرافيا." : "Short challenges in science, math, language, and geography."} />
      <Card><CardContent className="p-7 text-center">
        {!done ? <><Badge className="mb-4">{index + 1}/{QUESTIONS.length}</Badge><h2 className="text-2xl font-bold">{ar ? QUESTIONS[index].ar : QUESTIONS[index].en}</h2>
        <div className="mt-6 grid gap-3">{(ar ? QUESTIONS[index].optionsAr : QUESTIONS[index].options).map((option, choice) => <Button key={option} size="lg" variant="outline" onClick={() => answer(choice)}>{option}</Button>)}</div></> :
        <Button size="lg" onClick={() => { setIndex(0); setScore(0); setStatus(ar ? "بدأ اختبار جديد." : "New quiz started."); }}><RotateCcw className="me-2" />{ar ? "العب مجددًا" : "Play again"}</Button>}
        <p className="mt-5 rounded-lg bg-muted p-3 font-medium" role="status" aria-live="polite">{status}</p>
      </CardContent></Card>
    </section></Layout>
  );
}
