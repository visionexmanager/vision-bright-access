import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useState, useCallback, useMemo } from "react";

// ── Character database ────────────────────────────────────────────────────────
interface Character {
  id: string;
  nameKey: string;
  emoji: string;
  traits: Record<string, boolean>;
}

const CHARACTERS: Character[] = [
  { id: "harry_potter",   nameKey: "akinator.char.harryPotter",   emoji: "🧙", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:true,  isCreature:false, flies:true,  isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "hermione",       nameKey: "akinator.char.hermione",      emoji: "📚", traits: { isReal:false, isMale:false, isFemale:true,  hasMagic:true,  hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:true,  isCreature:false, flies:true,  isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "sherlock",       nameKey: "akinator.char.sherlock",      emoji: "🔍", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:true,  isClever:true,  isLeader:false, usesWeapon:false }},
  { id: "spider_man",     nameKey: "akinator.char.spiderMan",     emoji: "🕷️", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:true,  isOld:false, isYoung:true,  isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:false }},
  { id: "batman",         nameKey: "akinator.char.batman",        emoji: "🦇", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:true,  isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "superman",       nameKey: "akinator.char.superman",      emoji: "🦸", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:true,  isOld:false, isYoung:false, isCreature:false, flies:true,  isHistorical:false, isClever:false, isLeader:false, usesWeapon:false }},
  { id: "darth_vader",    nameKey: "akinator.char.darthVader",    emoji: "⚫", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:true,  isHero:false, isVillain:true,  wearsSpecialCostume:true,  isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:true,  usesWeapon:true  }},
  { id: "elsa",           nameKey: "akinator.char.elsa",          emoji: "❄️", traits: { isReal:false, isMale:false, isFemale:true,  hasMagic:true,  hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:true,  isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:true,  isCreature:false, flies:false, isHistorical:false, isClever:false, isLeader:true,  usesWeapon:false }},
  { id: "pikachu",        nameKey: "akinator.char.pikachu",       emoji: "⚡", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:true,  isCreature:true,  flies:false, isHistorical:false, isClever:false, isLeader:false, usesWeapon:false }},
  { id: "mickey_mouse",   nameKey: "akinator.char.mickeyMouse",   emoji: "🐭", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:true,  flies:false, isHistorical:false, isClever:false, isLeader:false, usesWeapon:false }},
  { id: "einstein",       nameKey: "akinator.char.einstein",      emoji: "🧠", traits: { isReal:true,  isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:false, isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:true,  isClever:true,  isLeader:false, usesWeapon:false }},
  { id: "da_vinci",       nameKey: "akinator.char.daVinci",       emoji: "🎨", traits: { isReal:true,  isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:false, isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:true,  isClever:true,  isLeader:false, usesWeapon:false }},
  { id: "napoleon",       nameKey: "akinator.char.napoleon",      emoji: "🎖️", traits: { isReal:true,  isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:false, isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:false, isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:true,  isClever:true,  isLeader:true,  usesWeapon:true  }},
  { id: "cleopatra",      nameKey: "akinator.char.cleopatra",     emoji: "👸", traits: { isReal:true,  isMale:false, isFemale:true,  hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:false, isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:false, isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:true,  isClever:true,  isLeader:true,  usesWeapon:false }},
  { id: "iron_man",       nameKey: "akinator.char.ironMan",       emoji: "🤖", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:false, isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:true,  isOld:false, isYoung:false, isCreature:false, flies:true,  isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "wonder_woman",   nameKey: "akinator.char.wonderWoman",   emoji: "🌟", traits: { isReal:false, isMale:false, isFemale:true,  hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:true,  isOld:false, isYoung:false, isCreature:false, flies:true,  isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "gandalf",        nameKey: "akinator.char.gandalf",       emoji: "🔮", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "dracula",        nameKey: "akinator.char.dracula",       emoji: "🧛", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:true,  isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:false, isVillain:true,  wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:true,  flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:false }},
  { id: "james_bond",     nameKey: "akinator.char.jamesBond",     emoji: "🔫", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
  { id: "cinderella",     nameKey: "akinator.char.cinderella",    emoji: "👠", traits: { isReal:false, isMale:false, isFemale:true,  hasMagic:true,  hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:true,  isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:true,  isCreature:false, flies:false, isHistorical:false, isClever:false, isLeader:false, usesWeapon:false }},
  { id: "yoda",           nameKey: "akinator.char.yoda",          emoji: "💚", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:false, isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:true,  flies:false, isHistorical:false, isClever:true,  isLeader:true,  usesWeapon:true  }},
  { id: "wolverine",      nameKey: "akinator.char.wolverine",     emoji: "⚔️", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:true,  isFromAnimated:true,  isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:false, isLeader:false, usesWeapon:true  }},
  { id: "shrek",          nameKey: "akinator.char.shrek",         emoji: "🟢", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:true,  isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:true,  isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:true,  flies:false, isHistorical:false, isClever:false, isLeader:false, usesWeapon:false }},
  { id: "dumbledore",     nameKey: "akinator.char.dumbledore",    emoji: "⭐", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:true,  hasPhysicalPowers:false, isFromBook:true,  isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:false, isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:true,  isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:true,  usesWeapon:true  }},
  { id: "indiana_jones",  nameKey: "akinator.char.indianaJones",  emoji: "🎩", traits: { isReal:false, isMale:true,  isFemale:false, hasMagic:false, hasPhysicalPowers:false, isFromBook:false, isFromMovie:true,  isFromComic:false, isFromAnimated:false, isFromGame:true,  isHero:true,  isVillain:false, wearsSpecialCostume:false, isOld:false, isYoung:false, isCreature:false, flies:false, isHistorical:false, isClever:true,  isLeader:false, usesWeapon:true  }},
];

// ── Questions ─────────────────────────────────────────────────────────────────
interface Question { id: string; trait: string; }

const QUESTIONS: Question[] = [
  { id: "akinator.q.real",           trait: "isReal"            },
  { id: "akinator.q.male",           trait: "isMale"            },
  { id: "akinator.q.female",         trait: "isFemale"          },
  { id: "akinator.q.magic",          trait: "hasMagic"          },
  { id: "akinator.q.physicalPowers", trait: "hasPhysicalPowers" },
  { id: "akinator.q.hero",           trait: "isHero"            },
  { id: "akinator.q.villain",        trait: "isVillain"         },
  { id: "akinator.q.movie",          trait: "isFromMovie"       },
  { id: "akinator.q.book",           trait: "isFromBook"        },
  { id: "akinator.q.comic",          trait: "isFromComic"       },
  { id: "akinator.q.animated",       trait: "isFromAnimated"    },
  { id: "akinator.q.game",           trait: "isFromGame"        },
  { id: "akinator.q.costume",        trait: "wearsSpecialCostume"},
  { id: "akinator.q.creature",       trait: "isCreature"        },
  { id: "akinator.q.flies",          trait: "flies"             },
  { id: "akinator.q.historical",     trait: "isHistorical"      },
  { id: "akinator.q.clever",         trait: "isClever"          },
  { id: "akinator.q.leader",         trait: "isLeader"          },
  { id: "akinator.q.young",          trait: "isYoung"           },
  { id: "akinator.q.weapon",         trait: "usesWeapon"        },
];

// answer weight: yes=1, probYes=0.6, dontKnow=0, probNo=-0.6, no=-1
type Answer = "yes" | "probYes" | "dontKnow" | "probNo" | "no";
const WEIGHTS: Record<Answer, number> = { yes: 1, probYes: 0.6, dontKnow: 0, probNo: -0.6, no: -1 };

function scoreCharacters(answers: { trait: string; weight: number }[]): { char: Character; score: number }[] {
  return CHARACTERS.map((char) => {
    let score = 0;
    for (const { trait, weight } of answers) {
      const traitVal = char.traits[trait] ?? false;
      score += traitVal ? weight : -weight;
    }
    return { char, score };
  }).sort((a, b) => b.score - a.score);
}

// Pick the next question that best splits remaining candidates
function pickNextQuestion(answered: Set<string>, answers: { trait: string; weight: number }[]): Question | null {
  const remaining = QUESTIONS.filter((q) => !answered.has(q.id));
  if (remaining.length === 0) return null;
  const scored = scoreCharacters(answers);
  const topCandidates = scored.slice(0, 10);
  // Pick question that splits top candidates most evenly
  let bestQ = remaining[0];
  let bestBalance = Infinity;
  for (const q of remaining) {
    const trueCount = topCandidates.filter((c) => c.char.traits[q.trait]).length;
    const balance = Math.abs(trueCount - topCandidates.length / 2);
    if (balance < bestBalance) { bestBalance = balance; bestQ = q; }
  }
  return bestQ;
}

type Phase = "intro" | "playing" | "guess" | "correct" | "wrong";

export default function Akinator() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<{ trait: string; weight: number }[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [guessResult, setGuessResult] = useState<{ char: Character; score: number } | null>(null);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);

  const MAX_QUESTIONS = 20;
  const GUESS_THRESHOLD = 8; // min questions before guessing

  const topCandidates = useMemo(() => scoreCharacters(answers), [answers]);

  const startGame = useCallback(() => {
    setPhase("playing");
    setAnswers([]);
    setAnsweredIds(new Set());
    setQuestionCount(0);
    setWrongGuesses([]);
    setGuessResult(null);
    const first = pickNextQuestion(new Set(), []);
    setCurrentQuestion(first);
    playSound("start");
  }, [playSound]);

  const handleAnswer = useCallback((answer: Answer) => {
    if (!currentQuestion) return;
    const weight = WEIGHTS[answer];
    const newAnswers = [...answers, { trait: currentQuestion.trait, weight }];
    const newAnsweredIds = new Set([...answeredIds, currentQuestion.id]);
    const newCount = questionCount + 1;

    setAnswers(newAnswers);
    setAnsweredIds(newAnsweredIds);
    setQuestionCount(newCount);
    playSound("navigate");

    const ranked = scoreCharacters(newAnswers);
    const top = ranked[0];
    const second = ranked[1];

    // Guess if confident enough or hit max questions
    const confident = top.score - (second?.score ?? 0) >= 4 && newCount >= GUESS_THRESHOLD;
    const exhausted = newCount >= MAX_QUESTIONS || newAnsweredIds.size >= QUESTIONS.length;

    if (confident || exhausted) {
      // Skip already-wrong guesses
      const candidate = ranked.find((r) => !wrongGuesses.includes(r.char.id));
      setGuessResult(candidate ?? top);
      setPhase("guess");
    } else {
      const next = pickNextQuestion(newAnsweredIds, newAnswers);
      setCurrentQuestion(next ?? null);
      if (!next) {
        const candidate = ranked.find((r) => !wrongGuesses.includes(r.char.id));
        setGuessResult(candidate ?? top);
        setPhase("guess");
      }
    }
  }, [currentQuestion, answers, answeredIds, questionCount, wrongGuesses, playSound]);

  const handleCorrect = useCallback(() => {
    setPhase("correct");
    playSound("success");
  }, [playSound]);

  const handleWrong = useCallback(() => {
    if (!guessResult) return;
    const newWrong = [...wrongGuesses, guessResult.char.id];
    setWrongGuesses(newWrong);
    playSound("navigate");

    // Try next best candidate not yet guessed
    const next = topCandidates.find((r) => !newWrong.includes(r.char.id));
    if (next && questionCount < MAX_QUESTIONS + 5) {
      setGuessResult(next);
      setPhase("guess");
    } else {
      // Ask more questions
      const nextQ = pickNextQuestion(answeredIds, answers);
      if (nextQ) {
        setCurrentQuestion(nextQ);
        setPhase("playing");
      } else {
        setPhase("wrong");
      }
    }
  }, [guessResult, wrongGuesses, topCandidates, questionCount, answeredIds, answers, playSound]);

  const progress = Math.min((questionCount / MAX_QUESTIONS) * 100, 100);

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10" aria-label={t("akinator.title")}>

        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 dark:from-violet-950 dark:via-purple-900 dark:to-indigo-950">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #a855f7 0%, transparent 60%), radial-gradient(circle at 70% 30%, #6366f1 0%, transparent 60%)" }} />
          <div className="relative px-6 py-12 text-center">
            <div className="text-7xl mb-4" role="img" aria-hidden="true">🔮</div>
            <h1 className="text-3xl font-bold text-white">{t("akinator.title")}</h1>
            <p className="mt-2 text-purple-200">{t("akinator.subtitle")}</p>
          </div>
        </div>

        {/* ── INTRO ───────────────────────────────────────────── */}
        {phase === "intro" && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <p className="text-lg text-muted-foreground leading-relaxed">{t("akinator.intro")}</p>
              <ul className="text-sm text-muted-foreground space-y-1 text-start max-w-xs mx-auto list-disc list-inside">
                <li>{t("akinator.hint1")}</li>
                <li>{t("akinator.hint2")}</li>
                <li>{t("akinator.hint3")}</li>
              </ul>
              <Button size="lg" onClick={startGame} className="px-10">
                {t("akinator.start")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── PLAYING ─────────────────────────────────────────── */}
        {phase === "playing" && currentQuestion && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">
                  {t("akinator.question")} {questionCount + 1} / {MAX_QUESTIONS}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t("akinator.thinkingOf")} 🔮
                </Badge>
              </div>
              <Progress value={progress} className="h-2" aria-label={t("akinator.progress")} />
              <CardTitle className="mt-4 text-xl leading-snug text-center">
                {t(currentQuestion.id)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5" role="group" aria-label={t("akinator.chooseAnswer")}>
                {(["yes", "probYes", "dontKnow", "probNo", "no"] as Answer[]).map((ans) => (
                  <Button
                    key={ans}
                    variant={ans === "yes" || ans === "probYes" ? "default" : ans === "no" || ans === "probNo" ? "destructive" : "outline"}
                    className="w-full text-sm"
                    onClick={() => handleAnswer(ans)}
                  >
                    {t(`akinator.ans.${ans}`)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── GUESS ───────────────────────────────────────────── */}
        {phase === "guess" && guessResult && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="text-6xl" role="img" aria-hidden="true">{guessResult.char.emoji}</div>
              <div>
                <p className="text-muted-foreground mb-2">{t("akinator.iThink")}</p>
                <p className="text-3xl font-bold">{t(guessResult.char.nameKey)}</p>
                {wrongGuesses.length > 0 && (
                  <Badge variant="secondary" className="mt-2">
                    {t("akinator.attempt")} {wrongGuesses.length + 1}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{t("akinator.isItCorrect")}</p>
              <div className="flex justify-center gap-4">
                <Button size="lg" onClick={handleCorrect} className="px-8">
                  ✅ {t("akinator.yes")}
                </Button>
                <Button size="lg" variant="outline" onClick={handleWrong} className="px-8">
                  ❌ {t("akinator.no")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── CORRECT ─────────────────────────────────────────── */}
        {phase === "correct" && guessResult && (
          <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="text-6xl" role="img" aria-hidden="true">🎉</div>
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">{t("akinator.wonTitle")}</h2>
              <p className="text-muted-foreground">
                {t("akinator.wonDesc").replace("{name}", t(guessResult.char.nameKey)).replace("{n}", String(questionCount))}
              </p>
              <Badge variant="secondary" className="text-base px-4 py-1">
                {guessResult.char.emoji} {t(guessResult.char.nameKey)}
              </Badge>
              <div>
                <Button size="lg" onClick={startGame} className="px-10">
                  {t("akinator.playAgain")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── WRONG (gave up) ─────────────────────────────────── */}
        {phase === "wrong" && (
          <Card className="border-destructive/50">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="text-6xl" role="img" aria-hidden="true">🤔</div>
              <h2 className="text-2xl font-bold">{t("akinator.lostTitle")}</h2>
              <p className="text-muted-foreground">{t("akinator.lostDesc")}</p>
              <Button size="lg" onClick={startGame} className="px-10">
                {t("akinator.playAgain")}
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </Layout>
  );
}
