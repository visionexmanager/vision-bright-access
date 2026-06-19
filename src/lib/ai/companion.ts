import { accessibilityProducts, generalProducts } from "@/data/products";
import { assistiveCategories } from "@/data/assistiveProducts";
import { supabase } from "@/integrations/supabase/client";

export type CompanionMemory = {
  enabled: boolean;
  notes: string[];
  updatedAt?: string;
};

export type CompanionPageContext = {
  title: string;
  path: string;
  url: string;
  section: string;
  description?: string;
  headings: string[];
  selectedText?: string;
};

export type CompanionToolResult = {
  handled: boolean;
  message?: string;
  navigateTo?: string;
  context?: Record<string, unknown>;
};

const MEMORY_KEY = "visionex-ai-memory-v1";
const MAX_NOTES = 8;

const routes = [
  { path: "/", section: "Home", terms: ["home", "main", "الرئيسية", "البداية"] },
  { path: "/marketplace", section: "Marketplace", terms: ["market", "marketplace", "store", "shop", "منتجات", "السوق", "المتجر"] },
  { path: "/assistive-products", section: "Assistive Products", terms: ["assistive", "accessibility", "braille", "مساعدة", "إتاحة", "برايل"] },
  { path: "/content", section: "Content", terms: ["content", "courses", "articles", "learning", "محتوى", "دورات", "مقالات", "تعلم"] },
  { path: "/services", section: "Services", terms: ["services", "service", "خدمات", "خدمة"] },
  { path: "/community", section: "Community", terms: ["community", "voice room", "rooms", "مجتمع", "رومات", "فويس"] },
  { path: "/games", section: "Games", terms: ["games", "play", "ألعاب", "العب"] },
  { path: "/bazaar", section: "VX Bazaar", terms: ["bazaar", "seller", "shop", "بازار", "بائع"] },
  { path: "/dashboard", section: "Dashboard", terms: ["dashboard", "account", "لوحة", "حسابي"] },
];

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private or hardened browser modes.
  }
}

export function loadCompanionMemory(): CompanionMemory {
  const raw = safeLocalStorageGet(MEMORY_KEY);
  if (!raw) return { enabled: true, notes: [] };
  try {
    const parsed = JSON.parse(raw) as CompanionMemory;
    return {
      enabled: parsed.enabled !== false,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, MAX_NOTES) : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { enabled: true, notes: [] };
  }
}

export function saveCompanionMemory(memory: CompanionMemory) {
  safeLocalStorageSet(MEMORY_KEY, JSON.stringify({
    enabled: memory.enabled,
    notes: memory.notes.slice(0, MAX_NOTES),
    updatedAt: new Date().toISOString(),
  }));
}

export function setCompanionMemoryEnabled(enabled: boolean): CompanionMemory {
  const memory = loadCompanionMemory();
  const next = { ...memory, enabled };
  saveCompanionMemory(next);
  void syncServerMemoryEnabled(enabled).catch(() => {});
  return next;
}

export function rememberCompanionNote(note: string): CompanionMemory {
  const memory = loadCompanionMemory();
  const clean = note.trim().replace(/\s+/g, " ").slice(0, 180);
  if (!memory.enabled || !clean) return memory;
  const notes = [clean, ...memory.notes.filter((item) => item.toLowerCase() !== clean.toLowerCase())];
  const next = { ...memory, notes: notes.slice(0, MAX_NOTES) };
  saveCompanionMemory(next);
  return next;
}

export async function syncServerMemoryEnabled(enabled: boolean) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await (supabase.from("ai_user_memory") as any).upsert(
    {
      user_id: data.user.id,
      memory_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function clearServerCompanionMemory() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await (supabase.from("ai_user_memory") as any).delete().eq("user_id", data.user.id);
}

export function buildCompanionPageContext(): CompanionPageContext {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { title: "Visionex", path: "/", url: "", section: "Unknown", headings: [] };
  }

  const path = window.location.pathname;
  const route = routes
    .filter((item) => path === item.path || (item.path !== "/" && path.startsWith(item.path)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
  const headings = Array.from(document.querySelectorAll("h1, h2"))
    .map((node) => node.textContent?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 6);
  const selectedText = window.getSelection()?.toString().trim().slice(0, 800);

  return {
    title: document.title || "Visionex",
    path,
    url: window.location.href,
    section: route?.section || "Visionex",
    description: metaDescription,
    headings,
    selectedText: selectedText || undefined,
  };
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function findRoute(input: string) {
  const normalized = normalize(input);
  return routes.find((route) => route.terms.some((term) => normalized.includes(normalize(term))));
}

function productIndex() {
  const storeProducts = [...generalProducts, ...accessibilityProducts].map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    rating: product.rating,
    inStock: product.inStock,
    source: "marketplace",
  }));

  const assistiveProducts = assistiveCategories.flatMap((category) =>
    category.products.map((product) => ({
      id: product.id,
      name: product.nameEn,
      description: product.specs.en.join("; "),
      category: category.nameEn,
      priceRange: `$${product.priceMin}-${product.priceMax}`,
      source: "assistive-products",
    }))
  );

  return [...storeProducts, ...assistiveProducts];
}

function searchProducts(query: string) {
  const terms = normalize(query).split(" ").filter((term) => term.length > 2);
  return productIndex()
    .map((product) => {
      const haystack = normalize(`${product.name} ${product.description} ${product.category}`);
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.product);
}

export function runCompanionTool(input: string, page: CompanionPageContext): CompanionToolResult {
  const normalized = normalize(input);
  const wantsOpen = /\b(open|go|navigate|show)\b/.test(normalized) || /افتح|روح|وديني|اعرض/.test(input);
  const wantsRemember = /\b(remember|save this|note that)\b/.test(normalized) || /تذكر|احفظ|خزن/.test(input);
  const wantsSummary = /\b(summarize|summary|explain this page)\b/.test(normalized) || /لخص|ملخص|اشرح الصفحة/.test(input);
  const wantsProducts = /\b(compare|recommend|product|products|braille|screen reader)\b/.test(normalized) || /قارن|رشح|اقترح|منتج|منتجات|برايل|قارئ شاشة/.test(input);

  if (wantsRemember) {
    const note = input
      .replace(/^(please\s+)?(remember|save this|note that)\s*/i, "")
      .replace(/^(تذكر|احفظ|خزن)\s*/i, "")
      .trim();
    const memory = rememberCompanionNote(note || input);
    return {
      handled: true,
      message: memory.enabled
        ? "تم، حفظت هذه المعلومة في ذاكرة المساعد على هذا الجهاز."
        : "الذاكرة متوقفة حالياً. فعّل الذاكرة إذا تبغاني أحفظ تفضيلاتك.",
    };
  }

  if (wantsOpen) {
    const route = findRoute(input);
    if (route) {
      return {
        handled: true,
        navigateTo: route.path,
        message: `فتحت لك قسم ${route.section}.`,
      };
    }
  }

  if (wantsSummary) {
    return {
      handled: false,
      context: {
        toolIntent: "summarize-current-page",
        pageSnapshot: page,
      },
    };
  }

  if (wantsProducts) {
    const matches = searchProducts(input);
    if (matches.length > 0) {
      return {
        handled: false,
        context: {
          toolIntent: "product-search-or-comparison",
          productMatches: matches,
        },
      };
    }
  }

  return { handled: false };
}
