// ─── VisionKids, on WhatsApp ────────────────────────────────────────────────
//
// The row said "Stories and learning games" and answered a tap with "not
// available yet". The stories were in `kids_stories` the whole time — the same
// table /kids reads on the site — so this channel now shows the same list from
// the same rows, and the tests below are mostly about the two ways that can go
// wrong: showing a row that cannot be delivered, and letting a request for
// something else be answered with storybooks.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { KidsStory } from "../../supabase/functions/_shared/whatsappKids.ts";

const kids = await import("../../supabase/functions/_shared/whatsappKids.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const story = (over: Partial<KidsStory> = {}): KidsStory => ({
  slug: "milo-the-curious-kitten",
  title: "Milo the Curious Kitten",
  subtitle: "A small cat with a big question",
  ageGroup: "3-5",
  language: "en",
  ...over,
});

describe("asking for the stories", () => {
  it("answers the words the menu row stands for, in both languages", () => {
    for (const text of ["kids stories", "قصص أطفال", "stories", "قصص", "VisionKids"]) {
      expect(kids.parseKidsRequest(text), text).toBe(true);
    }
  });

  it("does not answer a sentence that merely mentions children", () => {
    // Whole-message matching, not a substring hunt. Each of these is somebody
    // saying something else, and a list of storybooks would be the assistant
    // talking over them.
    for (const text of [
      "my kids love the radio",
      "هل يوجد خصم للأطفال؟",
      "can I buy a story book from the bazaar",
      "",
      "   ",
    ]) {
      expect(kids.parseKidsRequest(text), text).toBe(false);
    }
  });

  it("refuses a message too long to be the name of a feature", () => {
    expect(kids.parseKidsRequest(`stories ${"x".repeat(60)}`)).toBe(false);
  });

  it("reads its words out of the catalog, so the row and the parser cannot drift", () => {
    const source = readFileSync("supabase/functions/_shared/whatsappKids.ts", "utf8");
    expect(source).toContain('nodeById("kids")');
    for (const language of ["ar", "en"] as const) {
      const phrase = catalog.localized(catalog.nodeById("kids")!.phrase!, language);
      expect(kids.parseKidsRequest(phrase), phrase).toBe(true);
    }
  });
});

describe("a tapped row", () => {
  it("round-trips a slug and nothing else", () => {
    expect(kids.parseKidsSelection(kids.kidsRowId("milo-the-curious-kitten")))
      .toBe("milo-the-curious-kitten");
  });

  it("refuses anything that is not a slug", () => {
    for (const id of [
      "kids.../etc/passwd",
      "kids.",
      "kids.Milo",
      "news.123",
      "kids.milo kitten",
      null,
      undefined,
      "",
    ]) {
      expect(kids.parseKidsSelection(id as string), String(id)).toBeNull();
    }
  });
});

describe("what comes back from the table", () => {
  it("drops a row with nothing to show", () => {
    const rows = [
      { slug: "a", title: "A story", subtitle: "", age_group: "6-8", language: "en" },
      { slug: "", title: "No slug" },
      { slug: "c", title: "   " },
      null,
      "not a row",
    ];
    expect(kids.readStories(rows).map((s) => s.slug)).toEqual(["a"]);
  });

  it("puts the pages in order and leaves the empty ones out", () => {
    const pages = kids.readPages([
      { page_number: 3, text_content: "third" },
      { page_number: 1, text_content: "first" },
      { page_number: 2, text_content: "   " },
    ]);
    expect(pages.map((p) => p.text)).toEqual(["first", "third"]);
  });

  it("survives a shape it was not given", () => {
    expect(kids.readStories(null)).toEqual([]);
    expect(kids.readPages(undefined)).toEqual([]);
  });
});

describe("the list a sender sees", () => {
  it("puts a story in the sender's own language first, and keeps the rest in order", () => {
    const ordered = kids.orderForLanguage(
      [story({ slug: "en-1" }), story({ slug: "ar-1", language: "ar" }), story({ slug: "en-2" })],
      "ar",
    );
    expect(ordered.map((s) => s.slug)).toEqual(["ar-1", "en-1", "en-2"]);
  });

  it("chooses on the age before the description", () => {
    // A nine-year-old's adventure is the wrong answer for a four-year-old, and
    // a parent listening to the row hears the age first this way.
    expect(kids.storyRowSubtitle(story())).toBe("3-5 · A small cat with a big question");
    expect(kids.storyRowSubtitle(story({ subtitle: "" }))).toBe("3-5");
  });

  it("fits inside the row Meta will accept, title and all", () => {
    const message = interactive.kidsMessage({
      stories: [{
        // Longer than a row title allows: a real one, from the table.
        id: kids.kidsRowId("the-robot-who-learned-to-smile"),
        title: "The Robot Who Learned to Smile",
        description: kids.storyRowSubtitle(story({ ageGroup: "6-8", subtitle: "A robot discovers what makes a good friend" })),
      }],
      language: "en",
    });
    const payload = message.interactive as {
      action: { sections: Array<{ rows: Array<{ title: string; description?: string }> }> };
    };
    for (const row of payload.action.sections[0].rows) {
      expect(row.title.length, row.title).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowTitle);
      expect((row.description ?? "").length).toBeLessThanOrEqual(catalog.LIST_LIMITS.rowDescription);
    }
    // The clipped title is why the text twin exists: it carries the whole one.
    expect(message.text).toContain("The Robot Who Learned to Smile");
  });
});

describe("the story itself", () => {
  const pages = [
    { pageNumber: 1, text: "Milo the kitten always wondered what was on the other side." },
    { pageNumber: 2, text: "One sunny day, Milo squeezed through a gap and met Pip." },
  ];

  it("sends the pages in order, as prose rather than as a numbered book", () => {
    const text = kids.formatStory({ story: story(), pages, language: "en" });
    expect(text.indexOf("Milo the kitten")).toBeLessThan(text.indexOf("One sunny day"));
    // Page numbers belong to the book on the site. Here they would be two more
    // things to listen past on the way to the story.
    expect(text).not.toMatch(/\b1\/2\b|\bPage 1\b/);
  });

  it("names the story, says who it is for, and says where the rest are", () => {
    const text = kids.formatStory({ story: story(), pages, language: "en" });
    expect(text).toContain("Milo the Curious Kitten");
    expect(text).toContain("A small cat with a big question");
    expect(text).toContain("3-5");
    expect(text).toContain(kids.KIDS_URL);
  });

  it("is written in the sender's language even when the story is not", () => {
    const arabic = kids.formatStory({ story: story(), pages, language: "ar" });
    // The story is the author's; the sentences around it are the interface, and
    // the interface is the sender's.
    expect(arabic).toContain("Milo the Curious Kitten");
    expect(arabic).toMatch(/[؀-ۿ]/);
  });
});

describe("what the webhook asks the database for", () => {
  it("shows only the stories the site shows", () => {
    expect(webhook).toContain('.from("kids_stories")');
    expect(webhook).toContain('.eq("status", "published")');
  });

  it("leaves out a story it could not tell", () => {
    // A branching story keeps its text in `kids_story_nodes`, not in pages, so
    // a row for it would answer a tap with nothing. One exists today.
    expect(webhook).toContain('.gt("page_count", 0)');
  });

  // Anchored on the branch, never on the name: `KIDS_ID_PREFIX` and
  // `SONG_ID_PREFIX` both appear in the import list two thousand lines above,
  // and slicing between those two occurrences is an empty string that contains
  // nothing and asserts nothing.
  const selectionBranch = (() => {
    const start = webhook.indexOf("incoming.selection?.startsWith(KIDS_ID_PREFIX)");
    const end = webhook.indexOf("incoming.selection?.startsWith(SONG_ID_PREFIX)");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return webhook.slice(start, end);
  })();

  it("keeps the flag working on a row that was sent before it was turned", () => {
    expect(selectionBranch).toContain('isAvailable(nodeById("kids"), disabled)');
  });

  it("reads the story again rather than trusting the id it was handed", () => {
    expect(selectionBranch).toContain('.eq("slug", slug)');
    expect(selectionBranch).toContain('.eq("status", "published")');
  });
});

describe("the row in the menu", () => {
  it("is switched on, and says what it can actually do", () => {
    const node = catalog.nodeById("kids")!;
    expect(node.enabled).toBe(true);
    expect(node.handler).toBeUndefined();
    expect(node.phrase).toBeTruthy();
    // The games are not promised: a chat window cannot carry one.
    for (const language of ["ar", "en"] as const) {
      expect(catalog.localized(node.description, language).toLowerCase()).not.toMatch(/game|ألعاب/);
    }
  });

  it("no longer answers a tap with an apology", () => {
    const source = readFileSync("supabase/functions/_shared/whatsappCatalog.ts", "utf8");
    const kidsNode = source.slice(source.indexOf('id: "kids"'), source.indexOf('id: "news"'));
    expect(kidsNode).not.toContain('handler: "coming_soon"');
  });
});
