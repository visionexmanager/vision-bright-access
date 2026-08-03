export type Mark = "correct" | "present" | "absent";
export type Lang = "ar" | "en";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Five-letter answers, kept free of hamza variants so one keyboard covers them. */
const AR_WORDS = [
  "مدرسة", "مكتبة", "حديقة", "سيارة", "مدينة", "بحيرة", "نافذة", "مفتاح", "طاولة", "مصباح",
  "ملابس", "جريدة", "رسالة", "حاسوب", "مهندس", "معلمة", "تلميذ", "جامعة", "كلمات", "قصيدة",
  "رواية", "بطاقة", "خريطة", "بوصلة", "سفينة", "دراجة", "حافلة", "ميدان", "سحابة", "عاصفة",
  "حرارة", "برودة", "سعادة", "والدة", "طفولة", "حكاية", "مزرعة", "حقيبة", "ملعقة", "صحيفة",
  "مطبعة", "زجاجة", "تفاحة", "بطيخة", "طماطم", "دجاجة", "وليمة", "فنجان", "منديل", "منشفة",
  "صابون", "كتابة", "دراسة", "تعليم", "معرفة", "ثقافة", "حضارة", "تاريخ", "رياضة", "بطولة",
  "تدريب", "سباحة", "سياحة", "بستان", "شجيرة", "زراعة", "فلاحة", "ماشية", "عصفور", "حمامة",
  "فراشة",
];

const EN_WORDS = [
  "about", "above", "actor", "adopt", "agree", "alarm", "album", "alert", "alive", "alone",
  "amber", "angle", "apple", "arrow", "aside", "asset", "audio", "badge", "baker", "beach",
  "began", "bench", "birth", "black", "blame", "blend", "block", "board", "boost", "brain",
  "brave", "bread", "break", "brick", "bring", "broad", "brown", "brush", "build", "cabin",
  "cable", "camel", "candy", "cargo", "carry", "chair", "charm", "chart", "cheap", "check",
  "chess", "chief", "child", "civic", "claim", "clean", "clear", "climb", "clock", "cloud",
  "coach", "coast", "count", "cover", "crane", "crown", "daily", "dance", "delta", "depth",
  "diary", "dream", "drink", "drive", "eagle", "early", "earth", "eight", "elbow", "empty",
  "enjoy", "entry", "equal", "event", "exact", "fable", "faith", "fancy", "fever", "field",
  "fifty", "final", "first", "flame", "flash", "fleet", "float", "focus", "force", "frame",
  "fresh", "front", "fruit", "giant", "glass", "globe", "grace", "grade", "grain", "grand",
  "grape", "grass", "green", "guard", "guest", "guide", "happy", "heart", "heavy", "honey",
  "horse", "hotel", "house", "human", "ideal", "image", "index", "input", "irony", "issue",
  "ivory", "jelly", "jewel", "joint", "judge", "juice", "knife", "known", "label", "large",
  "later", "laugh", "layer", "learn", "lemon", "level", "light", "lucky", "lunar", "magic",
  "major", "maple", "march", "match", "medal", "media", "mercy", "metal", "meter", "might",
  "model", "money", "month", "motor", "mount", "mouse", "movie", "music", "night", "noble",
  "noise", "north", "novel", "nurse", "ocean", "offer", "olive", "onion", "orbit", "order",
  "organ", "otter", "outer", "owner", "paint", "panel", "paper", "party", "peace", "pearl",
  "phase", "phone", "photo", "piano", "piece", "pilot", "pitch", "place", "plane", "plant",
  "plate", "point", "polar", "power", "press", "price", "pride", "prime", "print", "prize",
  "proof", "proud", "pulse", "queen", "quick", "quiet", "quilt", "quote", "radio", "raise",
  "ranch", "range", "rapid", "reach", "ready", "realm", "rebel", "relax", "reply", "resort",
  "rider", "ridge", "right", "river", "roast", "robot", "round", "route", "royal", "rugby",
  "salad", "sauce", "scale", "scene", "scope", "score", "sense", "serve", "shade", "shape",
  "share", "sharp", "sheep", "shelf", "shine", "shirt", "shore", "short", "sight", "silver",
  "simple", "sixty", "skill", "sleep", "slide", "small", "smart", "smile", "smoke", "snake",
  "solar", "solid", "solve", "sound", "south", "space", "spare", "speak", "speed", "spend",
  "spice", "spine", "sport", "stage", "stamp", "stand", "start", "state", "steam", "steel",
  "stone", "storm", "story", "study", "style", "sugar", "sunny", "super", "sweet", "swift",
  "table", "taste", "teach", "thank", "theme", "there", "thing", "think", "third", "three",
  "throw", "tiger", "title", "today", "token", "tooth", "topic", "total", "touch", "tower",
  "trace", "track", "trade", "trail", "train", "treat", "trend", "trial", "tribe", "trust",
  "truth", "twice", "uncle", "under", "union", "unite", "upper", "urban", "usual", "valid",
  "value", "vapor", "vault", "video", "villa", "vital", "vivid", "vocal", "voice", "wagon",
  "waste", "watch", "water", "wheat", "wheel", "where", "which", "while", "white", "whole",
  "windy", "world", "worth", "would", "wound", "write", "young", "youth", "zebra",
].filter((word) => word.length === WORD_LENGTH);

export const WORDS: Record<Lang, string[]> = { ar: AR_WORDS, en: EN_WORDS };

export const AR_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض",
  "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي", "ة",
];

export const EN_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export function letters(lang: Lang): string[] {
  return lang === "ar" ? AR_LETTERS : EN_LETTERS;
}

export function pickWord(lang: Lang): string {
  const list = WORDS[lang];
  return list[Math.floor(Math.random() * list.length)];
}

export function isKnownWord(guess: string, lang: Lang): boolean {
  return WORDS[lang].includes(guess);
}

/**
 * Marks a guess against the answer. Exact hits are claimed first so a repeated
 * letter is only shown as "present" while unmatched copies remain in the answer.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const guessLetters = [...guess];
  const answerLetters = [...answer];
  const marks: Mark[] = new Array(guessLetters.length).fill("absent");
  const remaining = new Map<string, number>();

  guessLetters.forEach((letter, index) => {
    if (letter === answerLetters[index]) {
      marks[index] = "correct";
    } else {
      remaining.set(answerLetters[index], (remaining.get(answerLetters[index]) ?? 0) + 1);
    }
  });

  guessLetters.forEach((letter, index) => {
    if (marks[index] === "correct") return;
    const left = remaining.get(letter) ?? 0;
    if (left > 0) {
      marks[index] = "present";
      remaining.set(letter, left - 1);
    }
  });

  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best mark seen so far for each letter, used to colour the on-screen keyboard. */
export function keyboardMarks(guesses: string[], answer: string): Record<string, Mark> {
  const state: Record<string, Mark> = {};
  for (const guess of guesses) {
    const marks = scoreGuess(guess, answer);
    [...guess].forEach((letter, index) => {
      const current = state[letter];
      if (!current || RANK[marks[index]] > RANK[current]) state[letter] = marks[index];
    });
  }
  return state;
}

export function markClass(mark: Mark | undefined): string {
  switch (mark) {
    case "correct": return "bg-emerald-600 text-white border-emerald-600";
    case "present": return "bg-amber-500 text-white border-amber-500";
    case "absent": return "bg-muted text-muted-foreground border-muted";
    default: return "bg-card";
  }
}
