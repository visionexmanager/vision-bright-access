import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const COOKIE_KEY = "vx_cookie_consent";

export function CookieBanner() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
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
      aria-label={isAr ? "إشعار الكوكيز" : "Cookie consent"}
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-2xl border bg-card shadow-xl animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-1">
            {isAr ? "نستخدم ملفات تعريف الارتباط" : "We use cookies"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isAr
              ? "نستخدم كوكيز لتذكّر تفضيلاتك وتشغيل الإعلانات عبر Google AdSense. بالمتابعة فأنت توافق على "
              : "We use cookies to remember your preferences and serve ads via Google AdSense. By continuing, you agree to our "}
            <Link
              to="/privacy-policy"
              className="text-primary underline underline-offset-2 hover:no-underline"
              onClick={accept}
            >
              {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
            </Link>
            {isAr ? "." : "."}
          </p>
        </div>

        <button
          onClick={decline}
          aria-label={isAr ? "إغلاق" : "Close"}
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
          {isAr ? "قبول الكل" : "Accept all"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={decline}
          className="flex-1 text-xs"
        >
          {isAr ? "الضروري فقط" : "Essential only"}
        </Button>
      </div>
    </div>
  );
}
