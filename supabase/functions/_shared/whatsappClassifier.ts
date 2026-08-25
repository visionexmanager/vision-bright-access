// Deciding what a message is about without paying a model to read it.
//
// ── Why this is the safest thing to move off a provider ─────────────────────
//
// A category is a routing label. It is never shown to the customer, never part
// of an answer, and an unclassified message is already a normal state that the
// webhook handles. So the blast radius of getting one wrong is small and
// bounded — which is exactly what makes it the right first candidate for local
// processing, and exactly what the image description is not.
//
// Today every message that `quickCategory` cannot settle costs a call to Groq's
// 8B model, with OpenAI behind it. That is one provider round trip per message
// to produce a word nobody reads.
//
// ── Local first, provider second — never local only ─────────────────────────
//
// This returns a confidence alongside the label, and the webhook takes the
// label only when the confidence clears a floor. Below it, the model is asked
// exactly as before. That is the whole design: coverage where it is certain,
// deference where it is not, and no case where a weak local guess silently
// replaces a good remote one.
//
// It also means partial language coverage is safe by construction. The lexicons
// below are thorough in Arabic and English, which is what this channel actually
// receives, and thinner elsewhere. A French complaint scores low, falls through,
// and is classified by the model — the same answer it gets today.
//
// ── The one category worth being careful about ──────────────────────────────
//
// `complaint` and `human_request` are the two labels `shouldEscalate` acts on,
// so a wrong one either wastes a person's time or loses a customer.
// `human_request` is already decided upstream by `userAskedForHuman`, so
// `complaint` is the one that matters — and it is held to a higher bar than the
// rest. Missing one is worse than deferring it, and deferring costs a call that
// was being made anyway.
//
// Pure: no `Deno`, no fetch, no database.

import { normaliseAlias } from "./whatsappRouter.ts";
import type { Category } from "./whatsappTriage.ts";

/**
 * How sure the classifier must be before its label is used.
 *
 * Set by what it costs to be wrong rather than by a tuning run: below this the
 * message goes to the model, which is what happens today, so the floor can only
 * ever cost a call that was already being made.
 */
export const LOCAL_CONFIDENCE_FLOOR = 0.55;

/**
 * The higher bar `complaint` has to clear.
 *
 * It is one of two labels that escalate a conversation to a person. A false
 * positive puts a routine question in a human queue; a false negative leaves an
 * unhappy customer with a bot. Deferring to the model is cheap and is the right
 * answer whenever the words are not plainly a grievance.
 */
export const COMPLAINT_CONFIDENCE_FLOOR = 0.72;

/** One signal: words that suggest a category, and how strongly. */
interface Signal {
  readonly weight: number;
  readonly words: readonly string[];
}

/**
 * The lexicons.
 *
 * Matched against a *folded* message — `normaliseAlias` lower-cases, strips
 * punctuation, folds Arabic-Indic digits, and normalises the alef, ya and ta
 * marbuta variants an Arabic keyboard produces. That is the same normaliser the
 * router uses to resolve a feature by name, so a word matches here for the same
 * reasons it matches there.
 *
 * Substring matching, deliberately, unlike the router's whole-message rule: a
 * category is a hint about a sentence, not a command, so "my payment failed"
 * should match on "payment". The Arabic entries are chosen with that in mind —
 * short function words that appear inside unrelated sentences are exactly the
 * hazard here, so every Arabic term below is a content word of three characters
 * or more.
 */
const LEXICON: Record<Exclude<Category, "general" | "media" | "human_request">, readonly Signal[]> = {
  billing: [
    { weight: 3, words: ["refund", "invoice", "receipt", "charged", "payment failed", "double charge", "overcharge"] },
    { weight: 2, words: ["payment", "price", "cost", "subscription", "billing", "pay", "paid", "card", "checkout", "vx balance", "wallet"] },
    { weight: 3, words: ["استرجاع", "استرداد", "فاتورة", "خصم مرتين", "خصمتوا", "رسوم"] },
    { weight: 2, words: ["دفع", "سعر", "تكلفة", "اشتراك", "محفظة", "رصيد", "بطاقة", "فلوس"] },
    { weight: 2, words: ["facture", "remboursement", "factura", "reembolso", "rechnung", "erstattung", "fatura", "ödeme", "قیمت", "قیمت"] },
  ],
  account: [
    { weight: 3, words: ["password", "log in", "login", "sign in", "cannot access", "locked out", "delete my account", "verification code"] },
    { weight: 2, words: ["account", "profile", "email address", "username", "register", "sign up", "otp"] },
    { weight: 3, words: ["كلمة السر", "كلمة المرور", "ما بقدر ادخل", "نسيت كلمة", "حذف حسابي", "رمز التحقق"] },
    { weight: 2, words: ["حساب", "تسجيل الدخول", "بروفايل", "الملف الشخصي", "ايميل", "بريدي"] },
    { weight: 2, words: ["compte", "mot de passe", "cuenta", "contraseña", "konto", "passwort", "hesap", "şifre"] },
  ],
  order: [
    { weight: 3, words: ["my order", "order number", "tracking", "where is my", "not delivered", "shipment", "delivery status"] },
    { weight: 2, words: ["order", "delivery", "shipped", "courier", "parcel", "package"] },
    { weight: 3, words: ["طلبي", "رقم الطلب", "وين طلبي", "ما وصل", "لم يصل", "تتبع"] },
    { weight: 2, words: ["طلب", "توصيل", "شحن", "المندوب", "الطرد"] },
    { weight: 2, words: ["commande", "livraison", "pedido", "envío", "bestellung", "lieferung", "sipariş", "kargo"] },
  ],
  bazaar: [
    { weight: 3, words: ["do you have", "in stock", "how much is the", "looking for a", "sell on", "open a shop"] },
    { weight: 2, words: ["product", "shop", "store", "seller", "buy", "browse", "catalogue", "catalog", "bazaar", "market"] },
    { weight: 3, words: ["عندكم", "متوفر", "بدي اشتري", "افتح متجر", "بكم سعر"] },
    { weight: 2, words: ["منتج", "متجر", "بضاعة", "بائع", "شراء", "سوق", "بازار"] },
    { weight: 2, words: ["produit", "boutique", "producto", "tienda", "produkt", "geschäft", "ürün", "mağaza"] },
  ],
  technical: [
    { weight: 3, words: ["not working", "doesn't work", "does not work", "error", "crash", "bug", "broken", "keeps failing", "wont load", "won't load", "blank screen"] },
    { weight: 2, words: ["slow", "stuck", "freeze", "problem with the app", "cannot open", "screen reader", "voiceover", "talkback"] },
    { weight: 3, words: ["ما بيشتغل", "لا يعمل", "مش شغال", "خطأ", "يتوقف", "معلق", "ما بيفتح", "الشاشة سوداء"] },
    { weight: 2, words: ["مشكلة", "بطيء", "عالق", "قارئ الشاشة", "التطبيق"] },
    { weight: 2, words: ["ne fonctionne pas", "erreur", "no funciona", "funktioniert nicht", "fehler", "çalışmıyor", "hata"] },
  ],
  complaint: [
    // Deliberately narrow: these are grievances, not questions that mention a
    // problem. A message can be `technical` and unhappy without being a
    // complaint, and mislabelling it puts it in a human queue for nothing.
    { weight: 4, words: ["unacceptable", "worst", "terrible service", "disgusted", "furious", "fed up", "sick of", "third time i", "no one replied", "nobody replied", "still waiting for", "i want compensation", "this is a scam"] },
    { weight: 3, words: ["complaint", "complain", "disappointed", "awful", "useless", "waste of money", "very bad", "rude"] },
    { weight: 4, words: ["غير مقبول", "اسوا", "خدمة سيئة", "زهقت", "تعبت منكم", "للمرة الثالثة", "محدا رد", "ما حدا رد", "لليوم منتظر", "بدي تعويض", "نصب"] },
    { weight: 3, words: ["شكوى", "اشتكي", "خيبة", "سيء جدا", "ما في فايدة", "ضياع وقت", "قلة احترام"] },
    { weight: 3, words: ["inacceptable", "réclamation", "inaceptable", "queja", "inakzeptabel", "beschwerde", "kabul edilemez", "şikayet"] },
  ],
  feedback: [
    { weight: 3, words: ["thank you so much", "great work", "well done", "love the app", "suggestion", "feature request", "please add"] },
    { weight: 2, words: ["thanks", "helpful", "nice", "good job", "appreciate", "idea for"] },
    { weight: 3, words: ["شكرا جزيلا", "احسنتم", "عمل رائع", "اقتراح", "تمنيت لو", "ياريت تضيفوا"] },
    { weight: 2, words: ["شكرا", "ممتاز", "جميل", "مفيد", "بارك الله"] },
    { weight: 2, words: ["merci beaucoup", "gracias", "sugerencia", "danke", "vorschlag", "teşekkür", "öneri"] },
  ],
};

export interface LocalVerdict {
  /** The label, or null when nothing cleared the floor. */
  category: Category | null;
  /** 0-1. What the webhook compares against the floor. */
  confidence: number;
  /** Signals that fired across every category. A count — safe to log. */
  matched: number;
  /** Signals that fired for the winning category. */
  signals: number;
  /** The heaviest single signal the winner matched. 4 means a whole phrase. */
  peak: number;
}

const EMPTY: LocalVerdict = { category: null, confidence: 0, matched: 0, signals: 0, peak: 0 };

/**
 * Score a message against every lexicon and return the best label, if any.
 *
 * ── How the confidence is built ─────────────────────────────────────────────
 *
 * Two things have to be true for a label to be trusted: the winner must have
 * real evidence, and it must be clearly ahead of whatever came second. A
 * message scoring 3 for `billing` and 3 for `order` is genuinely ambiguous and
 * a coin flip is worse than asking the model, so the margin matters as much as
 * the total.
 *
 * Confidence is therefore the strength of the winner multiplied by how far
 * clear it is. Both are bounded to 0-1, so their product is too.
 */
export function classifyLocally(input: {
  text: string;
  askedForHuman?: boolean;
  hasMedia?: boolean;
}): LocalVerdict {
  const folded = normaliseAlias(input.text ?? "");
  if (!folded || folded.length < 2) return EMPTY;

  const scores = new Map<Category, { score: number; hits: number; peak: number }>();
  let matched = 0;

  for (const [category, signals] of Object.entries(LEXICON) as Array<[Category, readonly Signal[]]>) {
    let score = 0;
    let hits = 0;
    let peak = 0;
    for (const signal of signals) {
      for (const word of signal.words) {
        // The lexicon is written in the same folded alphabet it is matched
        // against, so a term with punctuation or a diacritic still lines up.
        if (folded.includes(normaliseAlias(word))) {
          score += signal.weight;
          hits += 1;
          peak = Math.max(peak, signal.weight);
          matched += 1;
        }
      }
    }
    if (score > 0) scores.set(category, { score, hits, peak });
  }

  if (scores.size === 0) return EMPTY;

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const [category, best] = ranked[0];
  const top = best.score;
  const runnerUp = ranked[1]?.[1].score ?? 0;

  // Strength: four points is a confident read — one strong phrase, or two
  // supporting words. Beyond that there is nothing more to learn.
  const strength = Math.min(top / 4, 1);
  // Margin: how far clear the winner is. A tie scores zero and defers.
  const margin = top > 0 ? (top - runnerUp) / top : 0;

  return { category, confidence: strength * margin, matched, signals: best.hits, peak: best.peak };
}

/**
 * The label to use, or null to ask the model.
 *
 * The only function the webhook needs. It applies the floors, including the
 * stricter one for `complaint`, so the decision about when local is good enough
 * lives in one place rather than in an `if` at the call site.
 */
export function localCategory(input: {
  text: string;
  askedForHuman?: boolean;
  hasMedia?: boolean;
}): LocalVerdict {
  const verdict = classifyLocally(input);
  if (!verdict.category) return verdict;

  // ── A single mild word is not a grievance ─────────────────────────────────
  //
  // "disappointed", on its own, scored high enough to be labelled a complaint
  // and escalated to a person — because with nothing else in the message there
  // is no runner-up, so the margin is perfect and the confidence follows. A
  // confidence built from one word is confident about very little.
  //
  // Stated as a rule rather than fixed by lowering a weight, because the rule
  // is the actual intent: a grievance is either said outright — one of the
  // whole phrases, which carry weight 4 — or it is said more than once. Anything
  // else goes to the model, which is what happens today.
  if (verdict.category === "complaint" && verdict.peak < 4 && verdict.signals < 2) {
    return { ...verdict, category: null };
  }

  const floor = verdict.category === "complaint"
    ? COMPLAINT_CONFIDENCE_FLOOR
    : LOCAL_CONFIDENCE_FLOOR;

  if (verdict.confidence < floor) {
    // Keep the confidence and the count for the log: "we nearly knew" is worth
    // being able to see when tuning this later.
    return { ...verdict, category: null };
  }
  return verdict;
}
