import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle, Theme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bell, Globe, Palette, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
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
];

export default function Settings() {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useThemeToggle();

  const [notifEnabled, setNotifEnabled] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted";
    }
    return false;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("visionex-sound") !== "false";
  });

  const handleNotifToggle = async (checked: boolean) => {
    if (checked) {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        setNotifEnabled(perm === "granted");
        if (perm === "granted") requestNotificationPermission();
      }
    } else {
      setNotifEnabled(false);
    }
  };

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    localStorage.setItem("visionex-sound", String(checked));
  };

  const handleThemeChange = (value: string) => {
    const themes: Theme[] = ["light", "dark", "high-contrast"];
    const target = value as Theme;
    // Toggle until we reach the target theme
    let current = theme;
    while (current !== target) {
      toggleTheme();
      const idx = themes.indexOf(current);
      current = themes[(idx + 1) % themes.length];
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
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
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">{t("settings.browserNotif")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.browserNotifDesc")}</p>
                </div>
                <Switch checked={notifEnabled} onCheckedChange={handleNotifToggle} />
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
