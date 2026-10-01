import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, decrypt, encrypt, hashPassword, safeEqual, totpAt, verifyPassword, verifyTotp } from "../src/crypto.js";
import { createLogger, redact } from "../src/logger.js";

describe("passwords", () => {
  it("verifies the right password and rejects a wrong or malformed one", async () => {
    const h = await hashPassword("Correct-Horse-9");
    expect(await verifyPassword("Correct-Horse-9", h)).toBe(true);
    expect(await verifyPassword("correct-horse-9", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(h).not.toContain("Correct");
  });
});

describe("TOTP", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC 6238 SHA-1 vector", () => {
    expect(totpAt(secret, Math.floor(59 / 30))).toBe("287082"); // 94287082 truncated to 6 digits
  });
  it("accepts one step of drift, rejects two", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step - 1), 0, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step - 2), 0, now)).toBeNull();
  });
  it("refuses a code whose step was already used (replay)", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step), step, now)).toBeNull();
  });
  it("round-trips base32", () => expect(base32Decode(base32Encode(Buffer.from("hello"))).toString()).toBe("hello"));
});

describe("encryption", () => {
  const key = Buffer.alloc(32, 1);
  it("round-trips and detects tampering", () => {
    const blob = encrypt("seed", key);
    expect(decrypt(blob, key)).toBe("seed");
    const parts = blob.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
    expect(() => decrypt(blob, Buffer.alloc(32, 2))).toThrow();
  });
  it("safeEqual is length-safe", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("log redaction", () => {
  it("never writes secrets, even nested", () => {
    const out: string[] = [];
    createLogger("t", (l) => out.push(l)).info("x", { password: "p1", nested: { api_key: "k1", authorization: "Bearer z", ok: "fine" }, cookie: "c" });
    const line = out[0]!;
    for (const s of ["p1", "k1", "Bearer z"]) expect(line).not.toContain(s);
    expect(line).toContain("fine");
    expect(redact({ otp: "123456" })).toEqual({ otp: "[redacted]" });
  });
});
