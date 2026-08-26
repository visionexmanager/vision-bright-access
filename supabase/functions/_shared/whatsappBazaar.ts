// Buying and selling, over WhatsApp.
//
// The assistant already answered marketplace questions — through the knowledge
// base, from whatever Visionex text happened to be embedded. That is fine for
// "how do returns work" and useless for "do you have honey": embedded prose
// does not know today's price or whether a thing is in stock, and a model
// asked anyway will invent both.
//
// So a shopping question goes to the shop. `bazaar_products` and
// `bazaar_shops` are read directly, and what comes back is what is actually
// listed — name, price, shop, stock — or an honest nothing.
//
// Pure and provider-free: intent, search terms and wording live here so the
// Vitest suite can pin them; the query itself is three lines in the webhook,
// where the Supabase client already is.

// The sentences are in `whatsappStrings.ts`, in all twenty languages. What
// stays here is the part that is not words: what counts as a shopping phrase,
// which terms are worth searching for, and how a listing is ordered.
import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Where a sender is sent to finish what they started here. */
export const BAZAAR_URL = "https://visionex.app/bazaar";

export type BazaarIntent = "buy" | "sell" | "browse";

export interface BazaarRequest {
  intent: BazaarIntent;
  /** Words to search listings for. Empty for a bare "show me the shop". */
  terms: string[];
  /**
   * Whether the message unambiguously meant the marketplace.
   *
   * "عندك رقم الدعم؟" — do you have the support number — is the same phrase a
   * shopper uses, and it is not a shopping question. Rather than choosing
   * between missing real searches and answering support questions with "no
   * products matched", the weak signals are marked and the webhook only
   * *replies* on them when the search actually found something. A weak miss
   * falls through to the assistant, which is where that question belonged.
   */
  confident: boolean;
}

/** Longest a message can be and still be read as a shopping request. */
export const BAZAAR_MAX_CHARS = 120;

// Latin spellings get `\b`; Arabic never does — see the same note in
// `whatsappVisionModes.ts`. `\bأشتري\b` matches nothing.

/** Names the marketplace outright. On its own, enough to mean "the shop". */
const MARKETPLACE = [
  /\b(bazaar|marketplace|market place|the (shop|store)|your (shop|store))\b/i,
  /(البازار|بازار|السوق|المتجر|متجرك|متجركم|المتجر الإلكتروني)/,
];

/**
 * Says "buy" and means it.
 *
 * Deliberately narrow. "بدي" and "أريد" are just "I want" — they open a
 * request to speak to a human as readily as a request to buy honey — and
 * matching them here would route an escalation into a product search. The verb
 * has to be about purchasing.
 */
const BUY_STRONG = [
  /\b(buy|purchase|order)\b/i,
  /(أشتري|اشتري|أشترى|شراء|أريد شراء|اريد شراء)/,
];

/**
 * Might mean the shop, might not.
 *
 * "Do you have…" is how someone asks for honey and how they ask for the
 * support number. Both reach the search; only one of them gets an answer from
 * it. See `confident` on `BazaarRequest`.
 *
 * Price lives here rather than with the strong verbs for the same reason, and
 * it is the case that matters most: "كم سعر الاشتراك" — how much is the
 * subscription — is a question about Visionex, not about the marketplace, and
 * treating a price phrase as certain would answer it with "no products
 * matched". As a weak signal it searches, finds nothing, and hands the question
 * back to the assistant, which knows the answer.
 */
const BUY_WEAK = [
  /\b(do you (have|sell)|is there any|looking for)\b/i,
  /\b(in stock|available|how much (is|are|for))\b/i,
  /(عندكم|عندك|متوفر|متوفرة|متوفره)/,
  /(بكم|كم سعر|كم ثمن|بكام|السعر)/,
];

/** Wants to sell something, or to open a shop. */
const SELL = [
  /\b(sell|selling|seller|open a (shop|store)|list (my|a) (product|item)|become a (seller|vendor))\b/i,
  /\b(i want to sell|how do i sell|can i sell)\b/i,
  /(أبيع|ابيع|بدي أبيع|بدي ابيع|أريد البيع|اريد البيع|أريد أن أبيع|بيع منتج|أعرض منتج|اعرض منتج)/,
  /(أفتح متجر|افتح متجر|أفتح محل|بائع|تاجر|كيف أبيع|كيف ابيع|أضيف منتج|اضيف منتج)/,
];

/**
 * Words that carry no product in them.
 *
 * The reason this list exists is a hazard this repository has hit before: short
 * Arabic function words are substrings of half the corpus, so searching for
 * `في` or `من` matches essentially every listing and returns a random shelf as
 * though it were a result. Combined with the three-character floor below, what
 * reaches the database is only words long and specific enough to mean
 * something.
 */
const STOPWORDS = new Set([
  // English
  "i", "im", "we", "you", "the", "a", "an", "is", "are", "was", "do", "does", "did",
  "have", "has", "any", "some", "for", "me", "my", "your", "please", "want", "wanna",
  "need", "looking", "look", "buy", "purchase", "order", "sell", "selling", "price",
  "cost", "how", "much", "many", "what", "which", "where", "and", "or", "of", "in",
  "on", "at", "to", "from", "with", "this", "that", "there", "here", "can", "could",
  "would", "get", "got", "find", "show", "give", "product", "products", "item",
  "items", "shop", "store", "bazaar", "marketplace", "stock", "available", "hello",
  "hi", "thanks", "thank",
  // Arabic
  "من", "في", "فى", "على", "عن", "إلى", "الى", "مع", "هل", "ما", "ماذا", "كم", "أي",
  "اي", "هذا", "هذه", "ذلك", "التي", "الذي", "هنا", "هناك", "أنا", "انا", "أنت",
  "انت", "لي", "لك", "لدي", "عندي", "عندك", "عندكم", "أريد", "اريد", "بدي", "أبغى",
  "ابغى", "أبي", "ابي", "لو", "سمحت", "فضلك", "شكرا", "شكراً", "مرحبا", "السلام",
  "أشتري", "اشتري", "شراء", "أبيع", "ابيع", "بيع", "سعر", "السعر", "بكم", "ثمن",
  "متوفر", "متوفرة", "متوفره", "يوجد", "موجود", "منتج", "المنتج", "منتجات",
  "المنتجات", "متجر", "المتجر", "السوق", "بازار", "البازار", "أدور", "ادور",
  "أبحث", "ابحث", "دور", "كيف", "وين", "فين", "أين", "اين",
  // Verbs that open a request without naming anything in it. "افتح لي السوق"
  // is a door being asked for, not a product: without these the first word
  // becomes the search term and the shop is searched for "افتح".
  "افتح", "أفتح", "اعرض", "أعرض", "ورني", "ورّيني", "شوفني", "عطني", "أعطني",
  "open", "browse", "view", "list", "visit", "check", "see", "tell", "about",
]);

/**
 * Shortest a word can be and still be searched for.
 *
 * Three, and the floor is the point: `ilike '%و%'` matches every row in the
 * table. Three characters is also the shortest real Arabic product noun —
 * `عسل`, `ماء`, `زيت` — so the floor costs nothing that matters.
 */
export const MIN_TERM_CHARS = 3;

/** How many words are searched for. Beyond three the AND narrows to nothing. */
export const MAX_TERMS = 3;

/**
 * The searchable words in a message.
 *
 * Arabic definite articles are stripped: someone typing `العسل` is looking for
 * a listing named `عسل`, and a substring search for the longer form finds
 * neither. Latin punctuation and Arabic diacritics go the same way.
 */
export function searchTerms(text: string): string[] {
  const normalised = (text ?? "")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!normalised) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of normalised.split(/\s+/)) {
    const word = raw.toLowerCase();
    if (STOPWORDS.has(word)) continue;

    // `العسل` -> `عسل`, but only when what is left is still a word.
    const stripped = /^ال\p{L}{3,}$/u.test(word) ? word.slice(2) : word;
    if (stripped.length < MIN_TERM_CHARS) continue;
    if (STOPWORDS.has(stripped)) continue;
    if (seen.has(stripped)) continue;

    seen.add(stripped);
    out.push(stripped);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

/**
 * Read a message as a shopping request, or decide it is not one.
 *
 * Deliberately conservative about price alone. "كم سعر الاشتراك" — how much is
 * the subscription — is a support question about Visionex, not a shopping
 * question about the bazaar, and answering it with "no products matched" would
 * be both wrong and rude. So a price phrase only routes here when it also names
 * something to price, and the knowledge base keeps everything else.
 */
export function parseBazaarRequest(text: string): BazaarRequest | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > BAZAAR_MAX_CHARS) return null;

  if (SELL.some((pattern) => pattern.test(trimmed))) {
    return { intent: "sell", terms: searchTerms(trimmed), confident: true };
  }

  const namesMarketplace = MARKETPLACE.some((pattern) => pattern.test(trimmed));
  const strongBuy = BUY_STRONG.some((pattern) => pattern.test(trimmed));
  const weakBuy = BUY_WEAK.some((pattern) => pattern.test(trimmed));
  if (!namesMarketplace && !strongBuy && !weakBuy) return null;

  const terms = searchTerms(trimmed);
  // A buying phrase with nothing to buy in it is not a search — it is either
  // "show me the shop" (when the marketplace was named) or ordinary chatter
  // that happened to contain "do you have", which belongs to the assistant.
  if (terms.length === 0) {
    return namesMarketplace ? { intent: "browse", terms: [], confident: true } : null;
  }
  return { intent: "buy", terms, confident: namesMarketplace || strongBuy };
}

/** A listing, as the webhook reads it out of the two bazaar tables. */
export interface BazaarListing {
  name: string;
  description: string | null;
  price: number;
  inStock: boolean;
  shopName: string | null;
}

/** Prices carry no currency in the schema, so none is invented in the reply. */
export function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

/**
 * Listings, as a message.
 *
 * One line per item, price included, because price is the question underneath
 * almost every "do you have". Out-of-stock items are shown rather than hidden —
 * "we have it but not right now" is a useful answer, and silently omitting it
 * makes the assistant look like it does not stock the thing at all.
 */
export function formatListings(params: {
  language: Language;
  listings: BazaarListing[];
  terms: string[];
}): string {
  const { language, listings, terms } = params;
  // The count used to be in this heading — "3 listings" — which needs one
  // plural form in English, two in Arabic and four in Russian. A template that
  // pretends otherwise reads as broken grammar, and the list is right below
  // anyway: nobody is counting it from the heading.
  const lines: string[] = [`🛍️ ${say("bazaarResultsHeading", language)}`, ""];

  for (const listing of listings) {
    const shop = listing.shopName
      ? say("bazaarFromShop", language).replace("{shop}", listing.shopName)
      : "";
    lines.push(
      say("bazaarListingLine", language)
        .replace("{name}", listing.name)
        .replace("{price}", formatPrice(listing.price))
        .replace("{shop}", shop)
        .replace("{stock}", listing.inStock ? "" : say("bazaarOutOfStock", language)),
    );
    if (listing.description) {
      lines.push(`  ${listing.description.replace(/\s+/g, " ").trim().slice(0, 140)}`);
    }
  }

  lines.push("");
  lines.push(say("bazaarBuyLink", language).replace("{url}", BAZAAR_URL));
  if (terms.length > 0) {
    lines.push(say("bazaarSearchedFor", language).replace("{terms}", terms.join(listSeparator(language))));
  }
  return lines.join("\n");
}

/**
 * How this language separates items in a list.
 *
 * Arabic, Persian and Urdu use their own comma, and Chinese and Japanese use a
 * full-width one. `Intl.ListFormat` would be the complete answer but it also
 * inserts "and", which is wrong for a list of search terms — this is the half
 * of it that applies.
 */
function listSeparator(language: Language): string {
  if (language === "ar" || language === "fa" || language === "ur") return "، ";
  if (language === "zh" || language === "ja") return "、";
  return ", ";
}

/**
 * Nothing matched.
 *
 * Says what was searched for, because the commonest cause is a word the
 * listings do not use, and a sender who can see the search terms can correct
 * them. It does not apologise for the marketplace being small.
 */
export function noListingsNotice(language: Language, terms: string[]): string {
  const searched = terms.join(listSeparator(language));
  return [
    searched
      ? say("bazaarNoMatch", language).replace("{terms}", searched)
      : say("bazaarNoMatchAny", language),
    say("bazaarBrowseAll", language).replace("{url}", BAZAAR_URL),
    say("bazaarTryAnother", language),
  ].join("\n");
}

/** The marketplace was named with nothing to look for. Point at the door. */
export function browseNotice(language: Language, listingCount: number): string {
  return [
    `🛍️ ${say("bazaarBrowseHeading", language)}`,
    listingCount > 0
      ? say("bazaarBrowseCount", language).replace("{count}", String(listingCount))
      : say("bazaarBrowseEmpty", language),
    say("bazaarBrowseLink", language).replace("{url}", BAZAAR_URL),
    say("bazaarBrowseAsk", language),
  ].join("\n");
}

/**
 * How to sell.
 *
 * Honest about the one thing that cannot happen here: a shop belongs to a
 * signed-in account, and a WhatsApp number is not one. `bazaar_shops.owner_id`
 * references `auth.users`, so there is no safe way to open a shop from a phone
 * number alone — and pretending otherwise would end with someone typing their
 * password into a chat window.
 */
export function sellGuidance(language: Language): string {
  return [
    say("sellHeading", language),
    "",
    say("sellStep1", language),
    say("sellStep2", language).replace("{url}", BAZAAR_URL),
    say("sellStep3", language),
    "",
    say("sellNote", language),
  ].join("\n");
}

/** The bazaar could not be read. A database fault, and not the sender's fault. */
export function bazaarUnavailableNotice(language: Language): string {
  return say("bazaarUnavailable", language).replace("{url}", BAZAAR_URL);
}
