// A free reply that remembers the last hour of the conversation.
//
// `chatFreeReplies.ts` answers one message. This turns a run of messages into a
// conversation: it keeps what the person said they like and who the plan is
// for, asks one question at a time (what do you enjoy → who will use it), and
// when it has enough, recommends the plan that covers it. A "yes" after the
// recommendation gets the subscribe steps; a "not now" gets a friendly close.
//
// ── What is remembered, and what is not ─────────────────────────────────────
//
// Only a few enum-like words: section keys (academy, arcade, …), who ("self",
// "child", "work"), the last question asked, the plan last suggested, how many
// turns. Never a message, a name, an address or a number. It is forgotten after
// an hour without a message (the database enforces that), and everything read
// back is validated against whitelists, so a corrupt row cannot become a reply.
//
// No model, no speech, no search: the same fixed text as before, sequenced.

import { fold } from "./chatSignup.ts";
import { EXAMPLES } from "./chatExamples.ts";
import { DISCOVER_STRINGS } from "./chatDiscoverStrings.ts";
import { FREE_STRINGS } from "./chatFreeRepliesStrings.ts";
import { GUIDE_STRINGS, SITE_PLANS, type GuideKey } from "./chatSiteGuideStrings.ts";
import { SIGNUP_STRINGS } from "./chatSignupStrings.ts";
import { freeTopic, interests, recommendPlan, SITE_URL, type FreeTopic } from "./chatFreeReplies.ts";
import { languageFor } from "./chatLanguage.ts";
import { PLANS_URL } from "./whatsappEntitlements.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./whatsappLanguages.ts";

export type Who = "self" | "child" | "work";
export type Last = "discover" | "who" | "recommend";

export interface Memory {
  interests: string[];
  who: Who | null;
  last: Last | null;
  plan: string | null;
  asked: Last[];
  turns: number;
  /** The language the conversation is in, so a bare «ok» is answered in it. */
  lang: SupportedLanguage | null;
}

const SECTIONS = new Set([
  "assistant", "academy", "library", "arcade", "kids", "marketplace", "tv", "radio", "career", "mediaStudio",
  "professional", "messages", "simulations", "studio", "finance",
]);
const WHO = new Set<string>(["self", "child", "work"]);
const LAST = new Set<string>(["discover", "who", "recommend"]);
const PLAN_IDS = new Set(SITE_PLANS.map((p) => p.id as string));

/** Longest conversation the bot will keep asking questions in; after that it only answers. */
const MAX_QUESTION_TURNS = 40;

export const emptyMemory = (): Memory => ({ interests: [], who: null, last: null, plan: null, asked: [], turns: 0, lang: null });

/** Anything read back from storage is checked against whitelists; nothing else gets through. */
export function sanitizeMemory(raw: unknown): Memory {
  const m = emptyMemory();
  if (!raw || typeof raw !== "object") return m;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.interests)) m.interests = [...new Set(r.interests.filter((x): x is string => typeof x === "string" && SECTIONS.has(x)))].slice(0, 12);
  if (typeof r.who === "string" && WHO.has(r.who)) m.who = r.who as Who;
  if (typeof r.last === "string" && LAST.has(r.last)) m.last = r.last as Last;
  if (typeof r.plan === "string" && PLAN_IDS.has(r.plan)) m.plan = r.plan;
  if (Array.isArray(r.asked)) m.asked = [...new Set(r.asked.filter((x): x is Last => typeof x === "string" && LAST.has(x)))] as Last[];
  if (typeof r.turns === "number" && Number.isFinite(r.turns)) m.turns = Math.max(0, Math.min(1000, Math.floor(r.turns)));
  if (typeof r.lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(r.lang)) m.lang = r.lang as SupportedLanguage;
  return m;
}

// ── Reading short answers ───────────────────────────────────────────────────

const CHILD = [
  "my son", "my daughter", "my child", "my kid", "my kids", "my children", "for my kids", "for my child",
  "ابني", "ابنتي", "طفلي", "اطفالي", "ولدي", "بنتي", "اولادي", "لطفلي", "لولدي", "لابني", "لبنتي", "لاطفالي",
  "mon fils", "ma fille", "mon enfant", "mes enfants", "mi hijo", "mi hija", "mis hijos", "mein sohn", "meine tochter", "mein kind", "meine kinder",
  "oglum", "kizim", "cocugum", "cocuklarim", "мой сын", "моя дочь", "мой ребенок", "мои дети", "پسرم", "دخترم", "فرزندم", "بچه ام", "بچه هام",
  "میرا بیٹا", "میری بیٹی", "میرا بچہ", "میرے بچے", "मेरा बेटा", "मेरी बेटी", "मेरा बच्चा", "मेरे बच्चे", "anak saya", "putra saya", "putri saya",
  "mio figlio", "mia figlia", "mio bambino", "i miei figli", "meu filho", "minha filha", "meus filhos", "mijn zoon", "mijn dochter", "mijn kind", "mijn kinderen",
  "moje dziecko", "moj syn", "moja corka", "con toi", "আমার ছেলে", "আমার মেয়ে", "আমার সন্তান", "我的孩子", "我儿子", "我女儿", "息子", "娘", "子どもが", "아들", "딸",
].map(fold);

const WORK = [
  "my business", "my company", "my team", "for work", "for my business", "our company", "our team",
  "شركتي", "عملي", "مشروعي", "فريقي", "للعمل", "لشركتي", "مؤسستي", "لمشروعي",
  "mon entreprise", "mon travail", "mon equipe", "pour le travail", "mi empresa", "mi trabajo", "mi equipo", "para el trabajo",
  "mein unternehmen", "meine firma", "mein team", "fur die arbeit", "sirketim", "ekibim", "моя компания", "моя работа", "моя команда", "для работы",
  "شرکتم", "کارم", "تیمم", "میری کمپنی", "میرا کاروبار", "میری ٹیم", "मेरी कंपनी", "मेरा व्यवसाय", "मेरी टीम", "perusahaan saya", "bisnis saya", "tim saya",
  "la mia azienda", "il mio lavoro", "il mio team", "minha empresa", "meu trabalho", "minha equipa", "minha equipe", "mijn bedrijf", "mijn werk", "mijn team",
  "moja firma", "moja praca", "moj zespol", "cong ty cua toi", "doanh nghiep cua toi", "আমার ব্যবসা", "আমার কোম্পানি", "我的公司", "我的团队", "工作用", "会社", "仕事用", "チーム", "회사", "업무",
].map(fold);

const SELF = [
  "for me", "myself", "just me", "for myself", "لنفسي", "لي انا", "لاستخدامي", "pour moi", "para mi", "fur mich", "kendim icin", "для себя", "для меня",
  "برای خودم", "اپنے لیے", "अपने लिए", "untuk saya", "per me", "para mim", "voor mezelf", "voor mij", "dla siebie", "dla mnie", "cho toi", "আমার জন্য", "我自己", "自分用", "저를 위해", "나를 위해",
].map(fold);

const YES = [
  "yes", "yeah", "yep", "ok", "okay", "sure", "please", "go ahead", "نعم", "ايه", "اي", "اكيد", "تمام", "طيب", "ماشي", "اوكي", "ايوه", "ايوا", "اجل",
  "oui", "d accord", "si", "vale", "claro", "ja", "gerne", "evet", "tamam", "да", "конечно", "ладно", "بله", "باشه", "ہاں", "ٹھیک", "हाँ", "ठीक", "ya", "oke", "baiklah",
  "sim", "tak", "dobrze", "vang", "হ্যাঁ", "好的", "可以", "はい", "네", "예",
].map(fold);

const NO = [
  "no", "not now", "later", "maybe later", "nope", "no thanks", "لا", "لاحقا", "مو الان", "ليس الان", "مش هلق", "بعدين",
  "non", "pas maintenant", "plus tard", "ahora no", "mas tarde", "nein", "spater", "hayir", "sonra", "нет", "не сейчас", "потом", "نه", "بعدا", "نہیں", "बाद में",
  "nanti", "tidak", "non ora", "depois", "nee", "nie", "khong", "না", "以后", "いいえ", "아니요",
].map(fold);

const has = (padded: string, list: readonly string[]) => list.some((w) => (/[؀-ۿऀ-৿぀-ヿ㐀-鿿가-힯]/u.test(w) ? padded.includes(w) : padded.includes(` ${w} `)));

export function detectWho(text: string | null | undefined): Who | null {
  const padded = ` ${fold(text ?? "")} `;
  if (has(padded, CHILD)) return "child";
  if (has(padded, WORK)) return "work";
  if (has(padded, SELF)) return "self";
  return null;
}

/** A short «yes» or «no», and nothing longer: a sentence that happens to contain «ok» is not an answer. */
export function shortAnswer(text: string | null | undefined): "yes" | "no" | null {
  const f = fold(text ?? "");
  if (!f || f.length > 24) return null;
  const padded = ` ${f} `;
  const word = (list: readonly string[]) => list.some((w) => padded.includes(` ${w} `)); // whole words only: «لا» is inside «الألعاب»
  if (word(NO)) return "no";
  if (word(YES)) return "yes";
  return null;
}

// ── The conversation ────────────────────────────────────────────────────────

const EXAMPLE_GROUPS = ["weather", "music", "alarm", "news", "recipes", "time", "transport", "facts"] as const;

function lang(language: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? (language as SupportedLanguage) : "en";
}

function fill(template: string, l: SupportedLanguage): string {
  return template
    .replaceAll("{plans}", PLANS_URL)
    .replaceAll("{site}", SITE_URL)
    .replaceAll("{here}", SIGNUP_STRINGS[l].here)
    .replaceAll("{basic}", "5").replaceAll("{pro}", "10").replaceAll("{business}", "20").replaceAll("{kids}", "3");
}

/** Three real example requests, varied from turn to turn. Empty when the language has none. */
function exampleLines(l: SupportedLanguage, turn: number): string {
  const bank = EXAMPLES[l] ?? EXAMPLES.en;
  const picks: string[] = [];
  for (let i = 0; i < EXAMPLE_GROUPS.length && picks.length < 3; i++) {
    const list = bank[EXAMPLE_GROUPS[(turn + i) % EXAMPLE_GROUPS.length]] ?? [];
    if (list.length) picks.push(`«${list[turn % list.length]}»`);
  }
  return picks.length ? `${DISCOVER_STRINGS[l].examplesLead} ${picks.join(" · ")}` : "";
}

const PLAIN: ReadonlySet<FreeTopic> = new Set<FreeTopic>(["thanks", "contact"]);

export interface Turn {
  topic: FreeTopic;
  body: string;
  memory: Memory;
  plan?: string;
}

/** One turn of the conversation. Pure: memory in, memory out. */
export function respond(text: string | null | undefined, language: string, previous: Memory): Turn {
  // The message's own language wins when it clearly has one; a bare «ok» keeps the conversation's.
  const l = languageFor(text, previous.lang, lang(language));
  const mem: Memory = { ...previous, interests: [...previous.interests], asked: [...previous.asked], turns: previous.turns + 1, lang: l };
  const topic = freeTopic(text);
  const found = interests(text);
  const who = detectWho(text);
  const answer = shortAnswer(text);
  const d = DISCOVER_STRINGS[l];
  const footer = fill(FREE_STRINGS[l].footer, l);

  // A «yes» or «no» only means something right after the bot asked or recommended.
  if (mem.last === "recommend" && answer === "yes") {
    mem.last = null;
    return { topic: "plans", body: fill(d.subscribe, l), memory: mem, plan: mem.plan ?? undefined };
  }
  if (mem.last && answer === "no") {
    mem.last = null;
    return { topic: "thanks", body: `${d.notNow}\n\n${footer}`, memory: mem };
  }

  for (const s of found) if (!mem.interests.includes(s)) mem.interests.push(s);
  if (who) mem.who = who;

  const parts: string[] = [];
  const returning = previous.turns > 0 && (previous.interests.length > 0 || previous.who !== null);
  const learned = found.length > 0 || who !== null;

  // What the message itself asked about.
  if (topic === "greeting" && returning) {
    parts.push(d.welcomeBack);
  } else if (topic !== "fallback" && topic !== "choose" && !(topic === "greeting" && learned)) {
    const sentence = topic in GUIDE_STRINGS.en ? GUIDE_STRINGS[l][topic as GuideKey] : FREE_STRINGS[l][topic as keyof typeof FREE_STRINGS.en];
    parts.push(fill(sentence, l));
  } else if (topic === "fallback" && !learned && !answer) {
    parts.push(FREE_STRINGS[l].fallback);
  }

  // A request the assistant handles gets real examples of how to ask.
  if (found.includes("assistant")) {
    const ex = exampleLines(l, mem.turns);
    if (ex) parts.push(ex);
  }

  // Thanks and contact are answered plainly: no nagging.
  if (PLAIN.has(topic) && !learned) {
    return { topic, body: [...parts, footer].join("\n\n"), memory: mem };
  }

  // The next step: one question at a time, then the recommendation.
  const wanted = [...mem.interests];
  if (mem.who === "child" && !wanted.includes("kids")) wanted.push("kids");
  if (mem.who === "work" && !wanted.includes("professional")) wanted.push("professional");
  const plan = recommendPlan(wanted);
  const nagging = mem.turns > MAX_QUESTION_TURNS;

  if (plan && (mem.who !== null || mem.asked.includes("who") || mem.interests.length >= 2 || mem.last === "recommend" || nagging)) {
    parts.push(d.recommend.replaceAll("{plan}", plan.name).replaceAll("{price}", String(plan.price)));
    mem.last = "recommend";
    mem.plan = plan.id;
  } else if (!nagging) {
    if (mem.interests.length > 0 && mem.who === null && !mem.asked.includes("who")) {
      parts.push(d.askWho);
      mem.asked.push("who");
      mem.last = "who";
    } else {
      parts.push(d.discover);
      if (!mem.asked.includes("discover")) mem.asked.push("discover");
      mem.last = "discover";
    }
  }

  parts.push(footer);
  return { topic, body: parts.join("\n\n"), memory: mem, ...(plan ? { plan: plan.id } : {}) };
}

// ── Storage ─────────────────────────────────────────────────────────────────

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Loads the hour's memory, answers, stores the new memory. A storage failure
 * never loses the answer: the person simply gets a reply without a past.
 */
export async function smartFreeReply(
  rpc: Rpc,
  channel: "whatsapp" | "meta",
  subject: string,
  text: string | null | undefined,
  language: string,
): Promise<Turn> {
  let previous = emptyMemory();
  try {
    const { data, error } = await rpc("chat_memory_get", { _channel: channel, _subject: subject });
    if (!error) previous = sanitizeMemory(data);
  } catch { /* answer without a past */ }

  const turn = respond(text, language, previous);

  try {
    await rpc("chat_memory_put", { _channel: channel, _subject: subject, _profile: turn.memory });
  } catch { /* the next message starts fresh */ }
  return turn;
}
