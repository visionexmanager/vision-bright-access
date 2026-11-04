import { describe, expect, it, vi } from "vitest";
import {
  CONVERTIBLE_IMAGE_MIMES,
  isImageMime,
  needsImageConversion,
  normaliseImage,
} from "../../supabase/functions/_shared/whatsappImageNormalise";

describe("whatsapp image normalising", () => {
  it("leaves the four readable formats alone", async () => {
    const convert = vi.fn();
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif; x=y"]) {
      const out = await normaliseImage({ bytes: new Uint8Array([1]), mimeType: mime, convert });
      expect(out.ok && !out.converted).toBe(true);
    }
    expect(convert).not.toHaveBeenCalled();
  });

  it("converts every other picture type to PNG", async () => {
    const png = new Uint8Array([9, 9]);
    const convert = vi.fn().mockResolvedValue({ ok: true, bytes: png, mime: "image/png" });
    for (const mime of CONVERTIBLE_IMAGE_MIMES) {
      expect(needsImageConversion(mime)).toBe(true);
      const out = await normaliseImage({ bytes: new Uint8Array([1]), mimeType: mime, convert });
      expect(out).toEqual({ ok: true, bytes: png, mimeType: "image/png", converted: true });
    }
    expect(convert.mock.calls[0][0].query).toBe("to=png");
  });

  it("reports a format the processor cannot decode", async () => {
    const convert = vi.fn().mockResolvedValue({ ok: false, code: "conversion_failed" });
    const out = await normaliseImage({ bytes: new Uint8Array([1]), mimeType: "image/heic", convert });
    expect(out).toEqual({ ok: false, reason: "conversion_failed" });
  });

  it("recognises a picture sent as a file, and nothing else", () => {
    expect(isImageMime("image/heic")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime(undefined)).toBe(false);
  });
});
