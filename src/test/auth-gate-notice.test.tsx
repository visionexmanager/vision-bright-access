// Being sent to the login form is not the same as choosing to open it.
//
// `AuthGuard` moves a signed-out visitor off a page that needs an account. The
// move is silent: the address changes, a login form appears, and nothing says
// which page was refused or why. For the primary user here — who is blind — the
// redirect is even quieter, because there is no visual jump to notice at all.
//
// So these assert the two halves of being told: the guard preserves where the
// visitor was going, and both auth pages say, in a live region, that an account
// is what stands between them and it. The destination has to survive the whole
// journey, including the hop to signup and back.

import { existsSync, readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/SocialAuthButtons", () => ({ SocialAuthButtons: () => null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
    rpc: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/useDeviceId", () => ({ useDeviceId: () => "device" }));

const authState = { user: null as { id: string } | null, loading: false };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const { AuthGuard } = await import("@/components/AuthGuard");
const Login = (await import("@/pages/Login")).default;
const Signup = (await import("@/pages/Signup")).default;

const VOICE = "/services/ai-media-studio/voice";
const NOTICE = en["auth.accountRequired"];

function renderAt(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={element} />
        <Route path="/signup" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("the guard keeps the destination", () => {
  it("sends a signed-out visitor to the login form, carrying the page they wanted", () => {
    // Reads the address the router actually landed on, rather than the
    // browser's — under MemoryRouter the two are unrelated, and asserting the
    // wrong one is how this test would pass while the destination was dropped.
    const Landed = () => {
      const location = useLocation();
      return <p>{`landed:${location.pathname}${location.search}`}</p>;
    };
    render(
      <MemoryRouter initialEntries={[VOICE]}>
        <Routes>
          <Route path={VOICE} element={<AuthGuard><p>voice studio</p></AuthGuard>} />
          <Route path="/login" element={<Landed />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("voice studio")).toBeNull();
    expect(screen.getByText(`landed:/login?returnTo=${encodeURIComponent(VOICE)}`)).toBeTruthy();
  });
});

describe("the login form says why it appeared", () => {
  it("announces that an account is needed, in a live region", () => {
    renderAt(`/login?returnTo=${encodeURIComponent(VOICE)}`, <Login />);
    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe(NOTICE);
    // Not the developer's sentence: the string comes from the dictionaries.
    expect(NOTICE).toBeTruthy();
    expect(NOTICE).not.toBe("auth.accountRequired");
  });

  it("stays quiet when somebody opened the form themselves", () => {
    renderAt("/login", <Login />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hands the destination on to signup rather than dropping it", () => {
    renderAt(`/login?returnTo=${encodeURIComponent(VOICE)}`, <Login />);
    const link = screen.getByRole("link", { name: en["nav.signup"] });
    expect(link.getAttribute("href")).toBe(`/signup?returnTo=${encodeURIComponent(VOICE)}`);
  });
});

describe("the signup form says the same thing", () => {
  it("announces it, and keeps the way back to login intact", () => {
    renderAt(`/signup?returnTo=${encodeURIComponent(VOICE)}`, <Signup />);
    expect(screen.getByRole("status").textContent).toBe(NOTICE);
    const link = screen.getByRole("link", { name: en["nav.login"] });
    expect(link.getAttribute("href")).toBe(`/login?returnTo=${encodeURIComponent(VOICE)}`);
  });

  it("stays quiet for somebody who came to sign up anyway", () => {
    renderAt("/signup", <Signup />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the sentence exists everywhere it will be read", () => {
  it("is translated in all twenty locales", () => {
    const locales = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl",
      "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];
    // Read as text, exactly as `i18n-integrity.test.ts` does. Importing twenty
    // dictionaries instead makes this one assertion slower than the whole rest
    // of the file, and it timed out under a full-suite run.
    for (const locale of locales) {
      const source = [`src/i18n/${locale}.ts`, `src/i18n/chunks/${locale}.ts`]
        .filter((path) => existsSync(path))
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
      const found = source.match(/^\s{2}"auth\.accountRequired":\s*"((?:[^"\\]|\\.)*)"/m);
      expect(found, locale).toBeTruthy();
      // English left in place is a missing translation, not a translation.
      if (locale !== "en") expect(found?.[1], locale).not.toBe(NOTICE);
    }
  });
});
