import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function LegacyArabicSection() {
  const { lang, setLang } = useLanguage();

  return (
    <section>
      <p>ما اسمك؟</p>
      <button type="button" aria-label="متابعة" onClick={() => setLang("es")}>
        متابعة
      </button>
      <output>{lang}</output>
    </section>
  );
}

function LanguageProbe() {
  const { lang } = useLanguage();
  useEffect(() => {
    document.body.dataset.selectedLanguage = lang;
  }, [lang]);
  return <LegacyArabicSection />;
}

function RuntimeLocaleProbe() {
  const { lang, setLang, t } = useLanguage();

  return (
    <section>
      <button type="button" onClick={() => setLang("fa")}>Select Persian</button>
      <p data-testid="selected-label">{lang === "fa" ? "فارسی — Persian" : "English — English"}</p>
      <h1>{t("home.title")}<span>{t("home.titleHighlight")}</span></h1>
      <button type="button" aria-label={t("cart.itemsLabel").replace("{count}", "0")}>Cart</button>
    </section>
  );
}

describe("LanguageProvider whole-site language consistency", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("visionex-lang", "en");
    delete document.body.dataset.selectedLanguage;
  });

  it("translates Arabic-authored sections into English and then the selected locale", async () => {
    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await waitFor(
      () => expect(screen.getByText("What's your name?")).toBeInTheDocument(),
      { timeout: 15_000 },
    );
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toHaveTextContent("Continue");

    fireEvent.click(continueButton);

    await waitFor(
      () => expect(screen.getByText("¿Cómo te llamas?")).toBeInTheDocument(),
      { timeout: 15_000 },
    );
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveTextContent("Continuar");
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dir).toBe("ltr");
  }, 20_000);

  it("does not restore the previous locale over a runtime language change", async () => {
    render(
      <LanguageProvider>
        <RuntimeLocaleProbe />
      </LanguageProvider>,
    );

    await waitFor(() => expect(screen.getByText("Select Persian")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Select Persian"));

    await waitFor(() => {
      expect(screen.getByTestId("selected-label")).toHaveTextContent("فارسی — Persian");
      expect(screen.getByRole("heading")).toHaveTextContent("Visionex همه چیز رادر یک پلتفرم جمع می‌کند");
    }, { timeout: 15_000 });
    expect(screen.getByRole("button", { name: "سبد خرید شامل 0 آیتم" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fa");
    expect(document.documentElement.dir).toBe("rtl");
  }, 20_000);
});
