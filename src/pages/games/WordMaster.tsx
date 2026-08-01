import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GameHeader } from "@/components/game/GameHeader";
import { GameInstructions } from "@/components/game/GameInstructions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameEconomy } from "@/components/game/GameEconomyGate";
import { Delete, CornerDownLeft, RotateCcw } from "lucide-react";
import {
  MAX_GUESSES, WORD_LENGTH, isKnownWord, keyboardMarks, letters, markClass, pickWord, scoreGuess,
} from "@/lib/games/wordMasterEngine";

export default function WordMaster() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const wordLang = ar ? "ar" : "en";
  const { playSound } = useSound();
  const { settleGameResult } = useGameEconomy();

  const [answer, setAnswer] = useState(() => pickWord(wordLang));
  const [guesses, setGuesses] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const settled = useRef(false);

  const text = useMemo(() => (ar ? {
    title: "سيد الكلمات",
    subtitle: "خمّن الكلمة المكوّنة من خمسة حروف خلال ست محاولات.",
    newGame: "كلمة جديدة",
    enter: "تأكيد",
    remove: "حذف",
    won: "أحسنت! خمّنت الكلمة.",
    lost: "انتهت المحاولات. الكلمة كانت:",
    tooShort: "الكلمة يجب أن تكون خمسة حروف.",
    unknown: "هذه الكلمة غير موجودة في القائمة.",
    tries: "المحاولات",
    correct: "في مكانه الصحيح",
    present: "موجود في مكان آخر",
    absent: "غير موجود",
    row: "المحاولة",
    letter: "حرف",
    howTo: "كيف تلعب",
    steps: [
      "اكتب كلمة من خمسة حروف باستخدام لوحة المفاتيح على الشاشة أو لوحة جهازك.",
      "الحرف الأخضر في مكانه الصحيح تماماً.",
      "الحرف البرتقالي موجود في الكلمة لكن في مكان آخر.",
      "الحرف الرمادي غير موجود في الكلمة إطلاقاً.",
      "لديك ست محاولات للوصول إلى الكلمة الصحيحة.",
    ],
  } : {
    title: "Word Master",
    subtitle: "Guess the five-letter word within six tries.",
    newGame: "New word",
    enter: "Enter",
    remove: "Delete",
    won: "Nicely done — you guessed it!",
    lost: "Out of tries. The word was:",
    tooShort: "The word must be five letters.",
    unknown: "That word is not in the list.",
    tries: "Tries",
    correct: "in the right place",
    present: "elsewhere in the word",
    absent: "not in the word",
    row: "Guess",
    letter: "letter",
    howTo: "How to play",
    steps: [
      "Type a five-letter word with the on-screen keyboard or your own.",
      "A green letter sits in exactly the right place.",
      "An orange letter is in the word but somewhere else.",
      "A grey letter is not in the word at all.",
      "You have six tries to land on the right word.",
    ],
  }), [ar]);

  const won = guesses.includes(answer);
  const over = won || guesses.length >= MAX_GUESSES;

  // A language switch mid-game needs a word from the new list.
  useEffect(() => {
    setAnswer(pickWord(wordLang));
    setGuesses([]);
    setDraft("");
    setStatus("");
    settled.current = false;
  }, [wordLang]);

  useEffect(() => {
    if (!over || settled.current) return;
    settled.current = true;
    if (won) {
      playSound("complete");
      setStatus(text.won);
      void settleGameResult("win", "Word Master");
    } else {
      playSound("error");
      setStatus(`${text.lost} ${answer}`);
      void settleGameResult("loss", "Word Master");
    }
  }, [over, won, answer, playSound, settleGameResult, text.won, text.lost]);

  const submit = useCallback(() => {
    if (over) return;
    if (draft.length !== WORD_LENGTH) { setStatus(text.tooShort); playSound("error"); return; }
    if (!isKnownWord(draft, wordLang)) { setStatus(text.unknown); playSound("error"); return; }
    setGuesses((past) => [...past, draft]);
    setDraft("");
    setStatus("");
    playSound("select");
  }, [draft, over, wordLang, playSound, text.tooShort, text.unknown]);

  const typeLetter = useCallback((letter: string) => {
    if (over) return;
    setDraft((current) => (current.length >= WORD_LENGTH ? current : current + letter));
    playSound("click");
  }, [over, playSound]);

  const backspace = useCallback(() => {
    setDraft((current) => [...current].slice(0, -1).join(""));
    playSound("delete");
  }, [playSound]);

  const keys = letters(wordLang);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") { event.preventDefault(); submit(); return; }
      if (event.key === "Backspace") { event.preventDefault(); backspace(); return; }
      const key = ar ? event.key : event.key.toLowerCase();
      if (keys.includes(key)) { event.preventDefault(); typeLetter(key); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, backspace, typeLetter, keys, ar]);

  const restart = () => {
    setAnswer(pickWord(wordLang));
    setGuesses([]);
    setDraft("");
    setStatus("");
    settled.current = false;
    playSound("start");
  };

  const keyMarks = useMemo(() => keyboardMarks(guesses, answer), [guesses, answer]);
  const markWord = { correct: text.correct, present: text.present, absent: text.absent };

  const rows = Array.from({ length: MAX_GUESSES }, (_, row) => {
    if (row < guesses.length) {
      const guess = guesses[row];
      return { word: guess, marks: scoreGuess(guess, answer), submitted: true };
    }
    if (row === guesses.length && !over) {
      return { word: draft.padEnd(WORD_LENGTH, " "), marks: null, submitted: false };
    }
    return { word: " ".repeat(WORD_LENGTH), marks: null, submitted: false };
  });

  return (
    <Layout>
      <section className="section-container max-w-lg py-8">
        <GameHeader
          title={text.title}
          extra={<Badge variant="outline">{text.tries} {guesses.length}/{MAX_GUESSES}</Badge>}
        />

        <p className="mb-4 text-sm text-muted-foreground">{text.subtitle}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={restart} className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{text.newGame}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-primary">
          {status}
        </p>

        <Card>
          <CardContent className="p-4">
            <div className="mx-auto grid max-w-xs gap-1.5">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-5 gap-1.5">
                  {[...row.word].map((letter, column) => {
                    const mark = row.marks?.[column];
                    const blank = letter === " ";
                    return (
                      <div
                        key={column}
                        aria-label={
                          blank
                            ? undefined
                            : `${text.row} ${rowIndex + 1}، ${text.letter} ${column + 1}: ${letter}${
                                mark ? ` — ${markWord[mark]}` : ""
                              }`
                        }
                        className={[
                          "flex aspect-square items-center justify-center rounded-md border-2 text-xl font-black uppercase",
                          row.marks ? markClass(mark) : blank ? "bg-card" : "border-primary bg-card",
                        ].join(" ")}
                      >
                        {blank ? "" : letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-1.5">
              {keys.map((letter) => (
                <Button
                  key={letter}
                  variant="outline"
                  size="sm"
                  disabled={over}
                  onClick={() => typeLetter(letter)}
                  aria-label={`${letter}${keyMarks[letter] ? ` — ${markWord[keyMarks[letter]]}` : ""}`}
                  className={`h-10 min-w-9 px-2 text-base font-bold uppercase ${markClass(keyMarks[letter])}`}
                >
                  {letter}
                </Button>
              ))}
            </div>

            <div className="mt-3 flex justify-center gap-2">
              <Button onClick={submit} disabled={over} className="gap-1.5">
                <CornerDownLeft className="h-4 w-4" aria-hidden="true" />{text.enter}
              </Button>
              <Button onClick={backspace} disabled={over} variant="outline" className="gap-1.5">
                <Delete className="h-4 w-4" aria-hidden="true" />{text.remove}
              </Button>
            </div>
          </CardContent>
        </Card>

        <GameInstructions title={text.howTo} steps={text.steps} />
      </section>
    </Layout>
  );
}
