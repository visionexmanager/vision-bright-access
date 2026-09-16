import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const server = read("supabase/functions/newsletter-preferences/index.ts");
const page = read("src/pages/NewsletterPreferences.tsx");
const signup = read("src/components/NewsletterSubscribe.tsx");

const setLiteral = (name: string) => {
  const match = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(server);
  if (!match) throw new Error(`${name} not found`);
  return new Set([...match[1].matchAll(/"([^"]+)"/g)].map(([, value]) => value));
};

describe("newsletter preferences: page and function agree", () => {
  it("accepts every email language the page offers", () => {
    const block = /const LANGUAGES: Record<string, string> = \{([\s\S]*?)\};/.exec(page);
    expect(block).not.toBeNull();
    const offered = [...block![1].matchAll(/(?:^|[\s,])([a-z]{2}):/g)].map(([, code]) => code);
    expect(offered).toHaveLength(20);
    const accepted = setLiteral("ALLOWED_LANGS");
    expect(offered.filter((code) => !accepted.has(code)), "offered but rejected as 'Invalid language'").toEqual([]);
  });

  it("accepts every interest the page and the sign-up form can send", () => {
    const accepted = setLiteral("ALLOWED_TOPICS");
    const fromPage = [...page.matchAll(/\["([a-z-]+)", "news\./g)].map(([, key]) => key);
    const fromSignup = [...signup.matchAll(/key: "([a-z-]+)"/g)].map(([, key]) => key);
    expect(fromPage.length).toBeGreaterThan(0);
    expect(fromSignup.length).toBeGreaterThan(0);
    expect([...fromPage, ...fromSignup].filter((key) => !accepted.has(key))).toEqual([]);
  });
});
