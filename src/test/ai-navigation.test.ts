import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/i18n/en";
import {
  MAIN_MENU_ID,
  MENU_TREE,
  childrenOf,
  controlsFor,
  findMenuNode,
  menuEntries,
  parentOf,
  resolveMenuInput,
} from "@/lib/ai/navigationMenu";

const companion = readFileSync("src/lib/ai/companion.ts", "utf8");
const useAIChat = readFileSync("src/hooks/useAIChat.ts", "utf8");

describe("one router, not two", () => {
  it("resolves a menu leaf into the existing navigateTo mechanism", () => {
    // The menu must not navigate by itself. It produces a path that
    // runCompanionTool returns as navigateTo, which useAIChat hands to the
    // same navigate() call it already used.
    expect(companion).toContain("navigateTo: resolution.path");
    expect(useAIChat).toContain("if (toolResult.navigateTo) navigate(toolResult.navigateTo)");
    expect(useAIChat).toContain("runCompanionTool(input, pageContext, menuId)");
  });

  it("leaves free-text chat untouched when the menu does not recognise input", () => {
    // "none" must fall through to the pre-existing tools rather than
    // swallowing the message.
    expect(companion).toContain('case "none":');
    expect(companion).toMatch(/case "none":\s*\n\s*break;/);
  });

  it("skips menu resolution entirely when no menu is shown", () => {
    expect(companion).toContain("if (menuId) {");
  });
});

describe("numbered selection", () => {
  it("selects the nth child of the current level", () => {
    const first = resolveMenuInput("1", MAIN_MENU_ID);
    expect(first.kind).toBe("open");
    expect(first.kind === "open" && first.node.id).toBe("products");

    const second = resolveMenuInput("2", MAIN_MENU_ID);
    expect(second.kind).toBe("navigate");
    expect(second.kind === "navigate" && second.path).toBe("/services");
  });

  it("numbers the controls after the children, matching what is announced", () => {
    const entries = menuEntries("products");
    const children = childrenOf("products");
    expect(entries.slice(0, children.length).map((e) => e.number)).toEqual([1, 2, 3, 4, 5]);

    // Products has 5 children, so 6 is the first control ("back").
    const sixth = resolveMenuInput("6", "products");
    expect(sixth.kind).toBe("back");
    expect(sixth.kind === "back" && sixth.node.id).toBe(MAIN_MENU_ID);
  });

  it("is contextual: the same number means different things per level", () => {
    expect(resolveMenuInput("1", MAIN_MENU_ID).kind).toBe("open");
    const inProducts = resolveMenuInput("1", "products");
    expect(inProducts.kind).toBe("navigate");
    expect(inProducts.kind === "navigate" && inProducts.path).toContain("electronics");
  });

  it("ignores a number with no option behind it", () => {
    expect(resolveMenuInput("99", MAIN_MENU_ID).kind).toBe("none");
  });
});

describe("controls", () => {
  it("offers no Back at the root, because a dead option wastes a blind user's time", () => {
    expect(controlsFor(MAIN_MENU_ID)).toEqual(["search", "help"]);
    expect(controlsFor("products")).toContain("back");
  });

  it("understands back, main menu, search and help in both languages", () => {
    expect(resolveMenuInput("back", "products").kind).toBe("back");
    expect(resolveMenuInput("رجوع", "products").kind).toBe("back");
    expect(resolveMenuInput("main menu", "products").kind).toBe("main");
    expect(resolveMenuInput("القائمة الرئيسية", "products").kind).toBe("main");
    expect(resolveMenuInput("help", MAIN_MENU_ID).kind).toBe("help");
    expect(resolveMenuInput("مساعدة", MAIN_MENU_ID).kind).toBe("help");
  });

  it("lifts the query out of a search phrase", () => {
    const resolved = resolveMenuInput("search braille display", MAIN_MENU_ID);
    expect(resolved.kind).toBe("search");
    expect(resolved.kind === "search" && resolved.query).toBe("braille display");
  });

  it("always allows an escape from a deep level", () => {
    for (const id of ["products.phones", "games.simulators", "news.sports"]) {
      const parentId = parentOf(id)?.id;
      expect(parentId, `${id} has a parent`).toBeTruthy();
      expect(controlsFor(parentId!)).toContain("back");
    }
  });
});

describe("natural language at the current level", () => {
  it("matches a child by its own words", () => {
    const resolved = resolveMenuInput("I want to buy something", MAIN_MENU_ID);
    expect(resolved.kind).toBe("open");
    expect(resolved.kind === "open" && resolved.node.id).toBe("products");
  });

  it("matches Arabic wording", () => {
    const resolved = resolveMenuInput("بدي أشوف الخدمات", MAIN_MENU_ID);
    expect(resolved.kind).toBe("navigate");
    expect(resolved.kind === "navigate" && resolved.path).toBe("/services");
  });

  it("does not jump to a branch that is not offered here", () => {
    // "computers" lives under Products. Saying it at the root must not
    // teleport past the level the user is on.
    expect(resolveMenuInput("computers", MAIN_MENU_ID).kind).toBe("none");
    expect(resolveMenuInput("computers", "products").kind).toBe("navigate");
  });

  it("does not match on one- or two-letter fragments", () => {
    // Short Arabic function words match nearly any sentence; the resolver
    // requires three characters, a hazard this codebase has hit in search.
    expect(resolveMenuInput("في", MAIN_MENU_ID).kind).toBe("none");
  });
});

describe("menu shape", () => {
  it("every leaf has a route and every branch has children", () => {
    const walk = (node: typeof MENU_TREE) => {
      const hasChildren = (node.children?.length ?? 0) > 0;
      if (!hasChildren) {
        expect(node.path, `${node.id} is a leaf and needs a path`).toBeTruthy();
      }
      node.children?.forEach(walk);
    };
    walk(MENU_TREE);
  });

  it("every label resolves to a real translation key", () => {
    const dictionary = en as Record<string, string>;
    const walk = (node: typeof MENU_TREE) => {
      expect(dictionary[node.labelKey], `missing key ${node.labelKey}`).toBeTruthy();
      node.children?.forEach(walk);
    };
    walk(MENU_TREE);
    for (const key of ["nav.back", "aiMenu.mainMenu", "aiMenu.search", "aiMenu.help", "aiMenu.hint"]) {
      expect(dictionary[key], `missing key ${key}`).toBeTruthy();
    }
  });

  it("keeps every level short enough to hold in your head", () => {
    // A menu read aloud is only usable if the list is short. Ten options plus
    // controls is the practical ceiling.
    const walk = (node: typeof MENU_TREE) => {
      const total = (node.children?.length ?? 0) + controlsFor(node.id).length;
      expect(total, `${node.id} offers ${total} options`).toBeLessThanOrEqual(14);
      node.children?.forEach(walk);
    };
    walk(MENU_TREE);
  });

  it("has no duplicate ids", () => {
    const ids: string[] = [];
    const walk = (node: typeof MENU_TREE) => {
      ids.push(node.id);
      node.children?.forEach(walk);
    };
    walk(MENU_TREE);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findMenuNode and parentOf agree with the tree", () => {
    expect(findMenuNode("products.phones")?.path).toBe("/marketplace?category=phones");
    expect(parentOf("products.phones")?.id).toBe("products");
    expect(parentOf(MAIN_MENU_ID)).toBeNull();
  });
});
