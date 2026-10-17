import { describe, expect, it, vi } from "vitest";
import { isPasswordBreached, sha1Hex } from "@/lib/pwnedPassword";

const res = (body: string, ok = true) => ({ ok, text: async () => body }) as unknown as Response;

describe("isPasswordBreached", () => {
  it("hashes with SHA-1 the way the range API expects", async () => {
    expect(await sha1Hex("password")).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("sends only the five-character prefix, never the password or full hash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res("0000000000000000000000000000000000A:0"));
    await isPasswordBreached("password", fetchMock as unknown as typeof fetch);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(url.split("/range/")[1]).toHaveLength(5);
    expect(url).not.toContain("1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("is true when the suffix is listed with a count", async () => {
    const f = vi.fn().mockResolvedValue(res("AAAA:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\r\nBBBB:1"));
    expect(await isPasswordBreached("password", f as unknown as typeof fetch)).toBe(true);
  });

  it("ignores padding rows whose count is 0, and absent suffixes", async () => {
    const pad = vi.fn().mockResolvedValue(res("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0"));
    expect(await isPasswordBreached("password", pad as unknown as typeof fetch)).toBe(false);
    const none = vi.fn().mockResolvedValue(res("AAAA:3"));
    expect(await isPasswordBreached("password", none as unknown as typeof fetch)).toBe(false);
  });

  it("fails open when the service errors or is unreachable", async () => {
    expect(await isPasswordBreached("password", vi.fn().mockResolvedValue(res("", false)) as unknown as typeof fetch)).toBe(false);
    expect(await isPasswordBreached("password", vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch)).toBe(false);
  });

  it("does not call the service for an empty password", async () => {
    const f = vi.fn();
    expect(await isPasswordBreached("", f as unknown as typeof fetch)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("wiring", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, readdirSync, existsSync } = require("node:fs") as typeof import("node:fs");

  it("both password forms run the check before submitting", () => {
    for (const page of ["src/pages/Signup.tsx", "src/pages/ResetPassword.tsx"]) {
      const src = readFileSync(page, "utf8");
      expect(src).toContain("isPasswordBreached(password)");
      expect(src.indexOf("isPasswordBreached(password)")).toBeLessThan(
        Math.max(src.indexOf("supabase.auth.signUp"), src.indexOf("supabase.auth.updateUser")),
      );
    }
  });

  it("the message exists in every locale", () => {
    const files = [
      // bn, hi and ru keep their strings in src/i18n/chunks; the file beside them only imports.
      ...readdirSync("src/i18n")
        .filter((f: string) => /^[a-z]{2}\.ts$/.test(f) && !/^(bn|hi|ru)\.ts$/.test(f))
        .map((f: string) => `src/i18n/${f}`),
      ...["bn", "hi", "ru"].map((l) => `src/i18n/chunks/${l}.ts`).filter((p: string) => existsSync(p)),
    ];
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const f of files) expect(readFileSync(f, "utf8"), f).toContain('"auth.passwordBreached"');
  });
});
