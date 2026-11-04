import { describe, expect, it } from "vitest";
import { readableTitle } from "../../supabase/functions/_shared/whatsappExternalFiles";

describe("readableTitle", () => {
  it("keeps real words", () => {
    expect(readableTitle("Full Moon over Petra")).toBe("Full Moon over Petra");
  });
  it("drops camera-file names a screen reader would garble", () => {
    expect(readableTitle("IMG 4821")).toBe("");
    expect(readableTitle("P1020345")).toBe("");
    expect(readableTitle("DSC_0042 2010")).toBe("");
  });
});

import { looksSpoken, matchesRequest } from "../../supabase/functions/_shared/whatsappExternalFiles";
import { parseAssetRequest } from "../../supabase/functions/_shared/whatsappImageRequest";

const item = (title: string, extra: Record<string, unknown> = {}) => ({ title, creator: null, description: null, tags: [], ...extra }) as never;

describe("a sound request gets a sound, not speech", () => {
  it("rejects a voice reading the article 'Airplane mode'", () => {
    expect(looksSpoken(item("En-Airplane mode"), "airplane")).toBe(true);
    expect(looksSpoken(item("Airplane mode (spoken Wikipedia)"), "airplane")).toBe(true);
    expect(looksSpoken(item("Aircraft flyover"), "airplane")).toBe(false);
    expect(looksSpoken(item("Jet-engine idle"), "jet engine")).toBe(false);
  });
  it("lets the word through when the sender asked for it", () => {
    expect(looksSpoken(item("Speech by Churchill"), "churchill speech")).toBe(false);
  });
  it("matches a recording titled by a synonym", () => {
    expect(matchesRequest(item("Aircraft flyover"), "airplane", true, 1)).toBe(true);
    expect(matchesRequest(item("Ocean waves"), "sea", true, 1)).toBe(true);
    expect(matchesRequest(item("Cooking pasta"), "airplane", true, 1)).toBe(false);
  });
  it("understands more Arabic sound words", () => {
    expect(parseAssetRequest("ابعتلي صوت طائرة")).toMatchObject({ kind: "audio" });
    expect(parseAssetRequest("بدي هدير الموج")).toMatchObject({ kind: "audio" });
  });
});
