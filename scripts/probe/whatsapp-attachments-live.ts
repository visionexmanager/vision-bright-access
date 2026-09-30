// Live check of the WhatsApp attachment flow against the real open sources, with
// Meta replaced by a stand-in: the file is fetched exactly as deliverAsset would
// fetch it (allowed hosts, redirect re-checks, size cap) and checked against Meta's
// rules, then reported. Nothing is sent to anyone. Prints kinds, hosts, sizes, no titles.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/probe/whatsapp-attachments-live.ts
import { attachExternalFile } from "../../supabase/functions/_shared/whatsappExternalFiles.ts";
import { deliveryRuleFor, fetchAssetBytes } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";

const cases: Array<[string, "book" | "audiobook" | "video", string]> = [
  ["book: a classic", "book", "frankenstein pdf"],
  ["book: a textbook", "book", "biology openstax file"],
  ["audiobook", "audiobook", "pride and prejudice mp3"],
  ["video", "video", "moon landing mp4"],
  ["book that no open source has", "book", "harry potter and the philosopher stone pdf"],
];
for (const [label, kind, query] of cases) {
  const seen: string[] = [];
  const out = await attachExternalFile({ kind, query, language: "en" }, {
    fetch: (u, i) => fetch(u, i),
    env: (n) => Deno.env.get(n),
    sendText: async () => undefined,
    deliver: async (asset) => {
      const rule = deliveryRuleFor(asset.mimeType)!;
      const got = await fetchAssetBytes({ url: asset.url!, allowedHosts: asset.allowedHosts!, maxBytes: rule.maxBytes });
      const host = new URL(asset.url!).hostname;
      if ("reason" in got) { seen.push(`${host} ${asset.mimeType} -> ${got.reason}`); return { outcome: "failed", reason: got.reason, ms: 0 }; }
      const right = rule.looksRight(got.bytes);
      seen.push(`${host} ${asset.mimeType} ${got.bytes.length}B served=${got.contentType.split(";")[0]} looksRight=${right}`);
      return right ? { outcome: `delivered_${rule.kind}`, kind: rule.kind, bytes: got.bytes.length, uploadTries: 1, sendTries: 1, ms: 0 } as never : { outcome: "failed", reason: "asset_content_mismatch", ms: 0 };
    },
  });
  console.log(`${label.padEnd(32)} ${JSON.stringify(out)}${seen.length ? "\n   " + seen.join("\n   ") : ""}`);
}
