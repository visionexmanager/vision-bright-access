import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAssetRequest, parseImageRequest } from "../../supabase/functions/_shared/whatsappImageRequest";

// A picture request used to kill the webhook with HTTP 546 ("CPU Time exceeded"): each word list was compiled
// into one pattern with its own lookbehind and lookahead per word, and the first request in a cold isolate
// spent ~600 ms compiling them. The patterns must keep ONE boundary pair around all the spaced words.
const source = readFileSync("supabase/functions/_shared/whatsappImageRequest.ts", "utf8");

describe("the picture-request patterns stay cheap to compile", () => {
  it("puts one boundary check around the whole word group, not one per word", () => {
    expect(source).toContain("(?:${spaced.join(\"|\")})");
    // The old shape: a boundary pair built inside the per-word map.
    expect(source).not.toMatch(/\.map\(\(w\) => \(SPACED_SCRIPT\.test\(w\) \? `\(\?<!/);
  });

  it("still decides the same way, in every script the lists cover", () => {
    expect(parseImageRequest("ابعتلي صورة قمر")).toMatchObject({ query: "قمر", wantsLink: false });
    expect(parseImageRequest("send me a photo of Petra")).toMatchObject({ query: "Petra" });
    expect(parseImageRequest("エッフェル塔の写真を送って")).not.toBeNull();
    expect(parseImageRequest("draw me a picture of a cat")).toBeNull();
    expect(parseImageRequest("picturesque village")).toBeNull();
    expect(parseAssetRequest("find me research papers about glaciers")).toMatchObject({ kind: "document" });
  });

  it("does the first parse in well under the 2 s CPU a request is allowed", () => {
    const started = performance.now();
    parseImageRequest("ابعتلي صورة أسد");
    parseAssetRequest("ابعتلي تسجيل صوتي للمطر");
    // Generous on purpose: the old shape took 600+ ms on a fast machine, and a loaded CI runner is slower.
    expect(performance.now() - started).toBeLessThan(400);
  });
});
