import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  imageHash,
  isCacheableDescription,
  readCachedDescription,
  storeDescription,
} from "../../supabase/functions/_shared/whatsappImageCache.ts";

const plain = { caption: "", mode: null, explainReport: false, hasBarcodeContext: false };

describe("image description cache", () => {
  it("answers only the plain question", () => {
    expect(isCacheableDescription(plain)).toBe(true);
    expect(isCacheableDescription({ ...plain, caption: "what colour is the car?" })).toBe(false);
    expect(isCacheableDescription({ ...plain, mode: "read_text" })).toBe(false);
    expect(isCacheableDescription({ ...plain, explainReport: true })).toBe(false);
    expect(isCacheableDescription({ ...plain, hasBarcodeContext: true })).toBe(false);
  });

  it("hashes the bytes, the same way every time, and differently for different pictures", async () => {
    const a = await imageHash(new Uint8Array([1, 2, 3]));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await imageHash(new Uint8Array([1, 2, 3]))).toBe(a);
    expect(await imageHash(new Uint8Array([1, 2, 4]))).not.toBe(a);
    // A view into a larger buffer hashes the view, not the buffer behind it.
    expect(await imageHash(new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4))).toBe(a);
  });

  it("treats every failure as a miss", async () => {
    const bad = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    expect(await readCachedDescription(bad, "h", "en")).toBeNull();
    const throws = { rpc: () => { throw new Error("down"); } };
    expect(await readCachedDescription(throws, "h", "en")).toBeNull();
    await expect(storeDescription(throws, "h", "en", "x")).resolves.toBeUndefined();
    expect(await readCachedDescription({ rpc: async () => ({ data: "  ", error: null }) }, "h", "en")).toBeNull();
    expect(await readCachedDescription({ rpc: async () => ({ data: "A cat.", error: null }) }, "h", "en")).toBe("A cat.");
  });

  it("stores through the RPC with the language", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await storeDescription({ rpc }, "abc", "ar", "قطة");
    expect(rpc).toHaveBeenCalledWith("image_description_cache_put", { _hash: "abc", _lang: "ar", _answer: "قطة" });
  });

  it("keeps the table private and expires rows", () => {
    const sql = readFileSync("supabase/migrations/20261111000100_image_description_cache.sql", "utf8");
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
    expect(sql).toContain("interval '14 days'");
  });
});
