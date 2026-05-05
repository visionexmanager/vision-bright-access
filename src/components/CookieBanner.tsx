import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const COOKIE_KEY = "vx_cookie_consent";

export function CookieBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) {
      // Small delay so it doesn't flash immediately on load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("cookie.label")}
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-2xl border bg-card shadow-xl animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("cookie.title")}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("cookie.description")}{" "}
            <Link
              to="/privacy-policy"
              className="text-primary underline underline-offset-2 hover:no-underline"
              onClick={accept}
            >
              {t("cookie.privacy")}
            </Link>
            .
          </p>
        </div>

        <button
          onClick={decline}
          aria-label={t("cookie.close")}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-2 px-5 pb-4 pt-0">
        <Button
          size="sm"
          onClick={accept}
          className="flex-1 text-xs"
        >
          <Check className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("cookie.acceptAll")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={decline}
          className="flex-1 text-xs"
        >
          {t("cookie.essentialOnly")}
        </Button>
      </div>
    </div>
  );
}
