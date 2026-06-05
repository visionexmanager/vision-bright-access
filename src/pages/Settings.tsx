import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle, Theme } from "@/contexts/ThemeContext";
import { useSound } from "@/contexts/SoundContext";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bell, Globe, Palette, Settings as SettingsIcon, Coins, Info } from "lucide-react";
import { useState } from "react";
import { requestNotificationPermission } from "@/hooks/useMessageNotifications";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
];

export default function Settings() {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, playSound } = useSound();
  const { currency, setCurrency } = useCurrency();

  const [notifEnabled, setNotifEnabled] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted";
    }
    return false;
  });
  const [notifRevokeTip, setNotifRevokeTip] = useState(false);

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    if (checked) playSound("toggle");
  };
  const handleNotifToggle = async (checked: boolean) => {
    if (checked) {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        setNotifEnabled(perm === "granted");
        setNotifRevokeTip(false);
        if (perm === "granted") requestNotificationPermission();
      }
    } else {
      // Browsers don't allow revoking notification permission via JS — show guidance
      setNotifRevokeTip(true);
      setNotifEnabled(false);
    }
  };


  const handleThemeChange = (value: string) => {
    setTheme(value as Theme);
  };

  return (
    <Layout>
      <div className="section-container py-12">
        {/* Page header with subtle brand background */}
        <div className="mb-8 rounded-2xl border bg-muted/30 px-6 py-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("settings.subtitle") || "Manage your language, appearance, and notification preferences"}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Bell className="h-5 w-5 text-primary" />
                {t("settings.notifications")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{t("settings.browserNotif")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.browserNotifDesc")}</p>
                  </div>
                  <Switch checked={notifEnabled} onCheckedChange={handleNotifToggle} />
                </div>
                {notifRevokeTip && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{t("settings.notifRevokeHint") || "To fully disable notifications, open your browser's site settings and set Notifications to \"Block\" for this site."}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">{t("settings.sounds")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.soundsDesc")}</p>
                </div>
                <Switch checked={soundEnabled} onCheckedChange={handleSoundToggle} />
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Globe className="h-5 w-5 text-primary" />
                {t("settings.language")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="mb-2 block text-base font-medium">{t("settings.selectLang")}</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="me-2">{lang.flag}</span>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Currency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Coins className="h-5 w-5 text-primary" />
                {t("settings.currency") || "Currency"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="mb-2 block text-base font-medium">{t("settings.selectCurrency") || "Display prices in your local currency"}</Label>
              <Select value={currency.code} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="me-2">{c.flag}</span>
                      {c.symbol} {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("settings.currencyNote") || "VX is always the main currency. Local currency is shown as an approximation."}
              </p>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Palette className="h-5 w-5 text-primary" />
                {t("settings.appearance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="mb-3 block text-base font-medium">{t("settings.selectTheme")}</Label>
              <RadioGroup value={theme} onValueChange={handleThemeChange} className="space-y-3">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="light" id="theme-light" />
                  <Label htmlFor="theme-light" className="text-base cursor-pointer">
                    ☀️ {t("settings.themeLight")}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="dark" id="theme-dark" />
                  <Label htmlFor="theme-dark" className="text-base cursor-pointer">
                    🌙 {t("settings.themeDark")}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="high-contrast" id="theme-hc" />
                  <Label htmlFor="theme-hc" className="text-base cursor-pointer">
                    👁️ {t("settings.themeHighContrast")}
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
