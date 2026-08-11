/**
 * Contextual numbered navigation for the AI assistant.
 *
 * This is a menu *shape* only. It does not navigate: resolving a leaf produces
 * a `path`, which `runCompanionTool` returns as `navigateTo` and `useAIChat`
 * hands to the existing `navigate()`. There is deliberately no second router —
 * a number, a button press, and a typed sentence all end at the same call.
 *
 * Every level is contextual: only the children of the current node are ever
 * offered, so a blind user hears a short list rather than the whole site.
 */

export interface MenuNode {
  id: string;
  /** i18n key. Existing `nav.*` keys are reused wherever the wording matches. */
  labelKey: string;
  /** Leaf nodes carry a route; branch nodes carry children. */
  path?: string;
  children?: MenuNode[];
  /** Extra words that should select this node in free text, per language. */
  terms?: string[];
}

export const MAIN_MENU_ID = "main";

export const MENU_TREE: MenuNode = {
  id: MAIN_MENU_ID,
  labelKey: "aiMenu.main",
  children: [
    {
      id: "products",
      labelKey: "aiMenu.products",
      terms: ["product", "products", "shop", "buy", "منتج", "منتجات", "شراء", "تسوق"],
      children: [
        { id: "products.electronics", labelKey: "aiMenu.electronics", path: "/marketplace?category=electronics", terms: ["electronics", "إلكترونيات", "الكترونيات"] },
        { id: "products.assistive", labelKey: "nav.assistiveProducts", path: "/assistive-products", terms: ["assistive", "accessibility", "braille", "مساعدة", "إتاحة", "برايل"] },
        { id: "products.phones", labelKey: "aiMenu.phones", path: "/marketplace?category=phones", terms: ["phone", "phones", "mobile", "هاتف", "جوال", "موبايل"] },
        { id: "products.computers", labelKey: "aiMenu.computers", path: "/marketplace?category=computers", terms: ["computer", "laptop", "pc", "حاسوب", "كمبيوتر", "لابتوب"] },
        { id: "products.appliances", labelKey: "aiMenu.appliances", path: "/marketplace?category=appliances", terms: ["appliance", "appliances", "home", "أجهزة منزلية", "منزلية"] },
      ],
    },
    { id: "services", labelKey: "nav.services", path: "/services", terms: ["service", "services", "خدمة", "خدمات"] },
    { id: "library", labelKey: "nav.library", path: "/library", terms: ["library", "book", "books", "مكتبة", "كتاب", "كتب"] },
    { id: "academy", labelKey: "aiMenu.academy", path: "/academy", terms: ["academy", "course", "courses", "learn", "أكاديمية", "اكاديمية", "دورة", "دورات", "تعلم"] },
    { id: "kids", labelKey: "nav.kids", path: "/kids", terms: ["kids", "children", "أطفال", "اطفال"] },
    {
      id: "games",
      labelKey: "aiMenu.gamesAndSimulators",
      terms: ["game", "games", "simulator", "simulation", "لعبة", "ألعاب", "العاب", "محاكاة", "محاكي"],
      children: [
        { id: "games.arcade", labelKey: "nav.games", path: "/games", terms: ["game", "games", "لعبة", "ألعاب"] },
        { id: "games.simulators", labelKey: "aiMenu.simulators", path: "/simulations", terms: ["simulator", "simulation", "محاكاة", "محاكي"] },
      ],
    },
    {
      id: "news",
      labelKey: "aiMenu.newsAndSports",
      terms: ["news", "sport", "sports", "أخبار", "اخبار", "رياضة"],
      children: [
        { id: "news.platform", labelKey: "nav.news", path: "/news", terms: ["news", "أخبار", "اخبار"] },
        { id: "news.sports", labelKey: "aiMenu.sports", path: "/services/sports", terms: ["sport", "sports", "رياضة"] },
      ],
    },
    { id: "community", labelKey: "nav.community", path: "/community", terms: ["community", "voice room", "مجتمع", "رومات"] },
    { id: "support", labelKey: "aiMenu.support", path: "/contact", terms: ["support", "help me", "contact", "human", "دعم", "مساعدة", "تواصل", "موظف"] },
  ],
};

/** Control entries appended to every level. Numbered after the children. */
export type MenuControl = "back" | "mainMenu" | "search" | "help";

export const CONTROL_LABEL_KEYS: Record<MenuControl, string> = {
  back: "nav.back",
  mainMenu: "aiMenu.mainMenu",
  search: "aiMenu.search",
  help: "aiMenu.help",
};

export function controlsFor(nodeId: string): MenuControl[] {
  // "Back" is meaningless at the root, and offering a dead option to someone
  // navigating by ear is worse than offering one fewer.
  return nodeId === MAIN_MENU_ID
    ? ["search", "help"]
    : ["back", "mainMenu", "search", "help"];
}

export function findMenuNode(id: string, node: MenuNode = MENU_TREE): MenuNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findMenuNode(id, child);
    if (found) return found;
  }
  return null;
}

export function parentOf(id: string, node: MenuNode = MENU_TREE): MenuNode | null {
  for (const child of node.children ?? []) {
    if (child.id === id) return node;
    const found = parentOf(id, child);
    if (found) return found;
  }
  return null;
}

/** The children offered at a level; empty for a leaf. */
export function childrenOf(id: string): MenuNode[] {
  return findMenuNode(id)?.children ?? [];
}

export type MenuResolution =
  | { kind: "open"; node: MenuNode }
  | { kind: "navigate"; node: MenuNode; path: string }
  | { kind: "back"; node: MenuNode }
  | { kind: "main"; node: MenuNode }
  | { kind: "search"; query: string }
  | { kind: "help" }
  | { kind: "none" };

const BACK_WORDS = [/\bback\b/i, /\bgo back\b/i, /(رجوع|ارجع|السابق|للخلف)/];
const MAIN_WORDS = [/\b(main menu|home menu|start over|go home)\b/i, /(القائمة الرئيسية|الرئيسية|من الأول|البداية)/];
const SEARCH_WORDS = [/\bsearch\b/i, /(ابحث|بحث)/];
const HELP_WORDS = [/\bhelp\b/i, /(مساعدة|ساعدني|كيف)/];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve one user utterance against the current level.
 *
 * Order matters. A bare number is checked first because it is unambiguous and
 * is the fastest path for a screen-reader user; control words come next so
 * "back" always escapes even when a child happens to contain the word; free
 * text is last.
 */
export function resolveMenuInput(rawInput: string, currentId: string): MenuResolution {
  const input = rawInput.trim();
  if (!input) return { kind: "none" };

  const children = childrenOf(currentId);
  const controls = controlsFor(currentId);

  // 1. A number selects by position: children first, then the controls.
  const asNumber = /^\d{1,2}$/.test(input) ? Number(input) : null;
  if (asNumber !== null && asNumber >= 1) {
    if (asNumber <= children.length) {
      const node = children[asNumber - 1];
      return node.path
        ? { kind: "navigate", node, path: node.path }
        : { kind: "open", node };
    }
    const control = controls[asNumber - children.length - 1];
    if (control) return resolveControl(control, currentId, "");
  }

  const normalized = normalize(input);

  // 2. Control words, so a user is never trapped at a level.
  if (BACK_WORDS.some((p) => p.test(input)) && controls.includes("back")) {
    return resolveControl("back", currentId, input);
  }
  if (MAIN_WORDS.some((p) => p.test(input))) return resolveControl("mainMenu", currentId, input);
  if (HELP_WORDS.some((p) => p.test(input))) return { kind: "help" };
  if (SEARCH_WORDS.some((p) => p.test(input))) {
    const query = input
      .replace(/\bsearch\b/i, "")
      .replace(/(ابحث عن|ابحث|بحث)/, "")
      .trim();
    return { kind: "search", query };
  }

  // 3. Free text against this level's children only — the menu is contextual,
  //    so a word matching a distant branch must not silently jump there.
  const match = children.find((child) => {
    const terms = child.terms ?? [];
    return terms.some((term) => {
      const t = normalize(term);
      // Require a whole-word-ish match: short Arabic words otherwise match
      // almost any sentence, a hazard this codebase has hit in search before.
      return t.length >= 3 && normalized.includes(t);
    });
  });

  if (match) {
    return match.path ? { kind: "navigate", node: match, path: match.path } : { kind: "open", node: match };
  }

  return { kind: "none" };
}

function resolveControl(control: MenuControl, currentId: string, input: string): MenuResolution {
  switch (control) {
    case "back": {
      const parent = parentOf(currentId) ?? MENU_TREE;
      return { kind: "back", node: parent };
    }
    case "mainMenu":
      return { kind: "main", node: MENU_TREE };
    case "search":
      return { kind: "search", query: input.replace(/\bsearch\b/i, "").replace(/(ابحث عن|ابحث|بحث)/, "").trim() };
    case "help":
      return { kind: "help" };
  }
}

/**
 * The numbered list for a level: children first, then controls, so the numbers
 * a user hears match the numbers `resolveMenuInput` accepts.
 */
export function menuEntries(nodeId: string): Array<{
  number: number;
  labelKey: string;
  kind: "child" | "control";
  childId?: string;
  control?: MenuControl;
}> {
  const children = childrenOf(nodeId);
  const controls = controlsFor(nodeId);

  return [
    ...children.map((child, index) => ({
      number: index + 1,
      labelKey: child.labelKey,
      kind: "child" as const,
      childId: child.id,
    })),
    ...controls.map((control, index) => ({
      number: children.length + index + 1,
      labelKey: CONTROL_LABEL_KEYS[control],
      kind: "control" as const,
      control,
    })),
  ];
}
