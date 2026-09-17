import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as catalog from "../../supabase/functions/_shared/whatsappCatalog";
import { readSession } from "../../supabase/functions/_shared/whatsappSession";
import { businessAccountIdOf, BUSINESS_ACCOUNT_SETTING } from "../../supabase/functions/_shared/whatsapp";
import { FOOTER_GROUPS } from "@/components/footerGroups";

// The owner's rule: everything in its right place — the Academy is not with the
// news — even if a menu grows. These pin where each thing lives, on WhatsApp and
// on the site, so a later edit cannot quietly mix a group again.

const ids = (parent: string) => catalog.childrenOf(parent).map((node) => node.id);

describe("the WhatsApp menu", () => {
  it("keeps ten groups, the most one WhatsApp list can show", () => {
    expect(ids(catalog.ROOT_ID)).toEqual([
      "assistant", "ocr", "explore", "headlines", "listen",
      "health", "services", "bazaar", "support", "more",
    ]);
  });

  it("puts learning with learning, and nothing else", () => {
    expect(ids("explore")).toEqual(["academy", "kids"]);
    expect(catalog.nodeById("explore")?.title.en).toBe("Learning");
  });

  it("gives the news and sports their own group", () => {
    expect(ids("headlines")).toEqual(["news", "sports"]);
    expect(catalog.nodeById("news")?.parent).not.toBe(catalog.nodeById("academy")?.parent);
  });

  it("puts the games with television, radio and songs", () => {
    expect(ids("listen")).toEqual(["services.radio", "services.songs", "listen.tv", "explore.games"]);
  });

  it("puts everything that reads what you hand over in one place", () => {
    expect(ids("ocr")).toEqual([
      "ocr.read", "ocr.describe", "ocr.find", "ocr.product", "ocr.translate", "ocr.document", "services.convert",
    ]);
    // The old group is gone. Somebody whose saved session still stands in it,
    // or inside a group a row has since left, is read back at the main menu —
    // `readSession` keeps only a real chain of parents.
    expect(catalog.nodeById("files")).toBeNull();
    expect(readSession({ nav_path: ["main", "files"] }).path).toEqual(["main"]);
    expect(readSession({ nav_path: ["main", "explore", "news"] }).path).toEqual(["main"]);
    expect(readSession({ nav_path: ["main", "headlines", "news"] }).path).toEqual(["main", "headlines", "news"]);
  });

  it("puts Visionex's services with the shop", () => {
    expect(ids("bazaar")).toEqual(["services.bazaar", "services.sell", "services.orders", "explore.services", "services.books"]);
  });

  it("fits every group inside a WhatsApp list", () => {
    for (const group of ids(catalog.ROOT_ID)) {
      // Ten rows a list, two of them Back and Main menu.
      expect(ids(group).length, group).toBeLessThanOrEqual(8);
    }
  });
});

describe("the site's menus", () => {
  const group = (id: string) => FOOTER_GROUPS.find((g) => g.id === id)!.links.map((link) => link.to);

  it("groups the footer by purpose", () => {
    expect(group("learning")).toEqual(["/academy", "/library", "/kids"]);
    expect(group("media")).toEqual(["/news", "/content", "/games"]);
    expect(group("work")).toEqual(["/careers", "/finance", "/professional-tools"]);
    expect(group("learning")).not.toContain("/news");
  });

  it("lists every page once, and loses none the footer had", () => {
    const all = FOOTER_GROUPS.flatMap((g) => g.links.map((link) => link.to));
    expect(new Set(all).size).toBe(all.length);
    for (const route of ["/", "/bazaar", "/services", "/finance", "/services/ai-media-studio", "/content", "/games",
      "/news", "/contact-us", "/professional-tools", "/services/file-studio", "/community", "/leaderboard",
      "/assistive-products", "/academy", "/library"]) {
      expect(all, route).toContain(route);
    }
  });

  it("names every group in all twenty languages", () => {
    for (const locale of ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"]) {
      const source = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      for (const key of ["nav.group.learning", "nav.group.work", "nav.group.media", "nav.group.community", "nav.group.account"]) {
        expect(source, `${locale} ${key}`).toContain(`"${key}":`);
      }
    }
  });
});

describe("the Business Account id the reminder template needs", () => {
  it("is read from a signed envelope, and from nothing else", () => {
    expect(businessAccountIdOf({ object: "whatsapp_business_account", entry: [{ id: "102938475610293" }] })).toBe("102938475610293");
    expect(businessAccountIdOf({ object: "page", entry: [{ id: "102938475610293" }] })).toBeNull();
    expect(businessAccountIdOf({ object: "whatsapp_business_account", entry: [{ id: "not-an-id" }] })).toBeNull();
    expect(businessAccountIdOf({ object: "whatsapp_business_account", entry: [] })).toBeNull();
    expect(businessAccountIdOf(null)).toBeNull();
  });

  it("is remembered only after the signature is checked", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const signature = webhook.indexOf("await verifySignature(rawBody");
    const remembered = webhook.indexOf("businessAccountIdOf(payload)");
    expect(signature).toBeGreaterThan(0);
    expect(remembered).toBeGreaterThan(signature);
    expect(webhook).toContain(".upsert({ key: BUSINESS_ACCOUNT_SETTING, value: businessAccount }, { onConflict: \"key\" })");
    expect(BUSINESS_ACCOUNT_SETTING).toBe("whatsapp_business_account_id");
  });

  it("is read by the template workflow, which retries on a schedule", () => {
    const workflow = readFileSync(".github/workflows/whatsapp-templates.yml", "utf8");
    expect(workflow).toMatch(/cron: "[^"]+"/);
    expect(workflow).toContain("SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
    expect(readFileSync("scripts/whatsapp-templates.mjs", "utf8")).toContain("key=eq.whatsapp_business_account_id");
  });
});
