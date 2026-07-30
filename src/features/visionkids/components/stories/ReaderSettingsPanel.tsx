import { Minus, Plus, Sun, Moon, Coffee, Contrast, Focus, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReaderSettings, ReaderFontFamily, ReaderBackground } from "@/features/visionkids/types/stories.types";

interface ReaderSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReaderSettings;
  onUpdate: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
}

const FONT_FAMILIES: { value: ReaderFontFamily; labelKey: string }[] = [
  { value: "sans", labelKey: "kids.reader.fontSans" },
  { value: "serif", labelKey: "kids.reader.fontSerif" },
  { value: "dyslexic", labelKey: "kids.reader.fontDyslexic" },
];

const BACKGROUNDS: { value: ReaderBackground; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "kids.reader.bgLight" },
  { value: "sepia", icon: Coffee, labelKey: "kids.reader.bgSepia" },
  { value: "night", icon: Moon, labelKey: "kids.reader.bgNight" },
  { value: "high-contrast", icon: Contrast, labelKey: "kids.reader.bgHighContrast" },
];

export function ReaderSettingsPanel({ open, onOpenChange, settings, onUpdate }: ReaderSettingsPanelProps) {
  const { t, dir } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full max-w-sm overflow-y-auto">
        <SheetTitle className="font-heading">{t("kids.reader.settingsTitle")}</SheetTitle>

        <div className="mt-6 flex flex-col gap-6">
          <div>
            <span className="text-sm font-semibold">{t("kids.reader.fontSize")}</span>
            <div className="mt-2 flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => onUpdate("fontSize", Math.max(14, settings.fontSize - 2))} aria-label={t("kids.reader.decreaseFontSize")}>
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="w-10 text-center text-sm" aria-live="polite">{settings.fontSize}px</span>
              <Button variant="outline" size="icon" onClick={() => onUpdate("fontSize", Math.min(40, settings.fontSize + 2))} aria-label={t("kids.reader.increaseFontSize")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold">{t("kids.reader.fontFamily")}</span>
            <div role="group" aria-label={t("kids.reader.fontFamily")} className="mt-2 flex flex-wrap gap-2">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={settings.fontFamily === f.value}
                  onClick={() => onUpdate("fontFamily", f.value)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    settings.fontFamily === f.value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold">{t("kids.reader.lineHeight")}</span>
            <div className="mt-2 flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => onUpdate("lineHeight", Math.max(1.2, +(settings.lineHeight - 0.1).toFixed(1)))} aria-label={t("kids.reader.decreaseLineHeight")}>
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="w-10 text-center text-sm" aria-live="polite">{settings.lineHeight.toFixed(1)}</span>
              <Button variant="outline" size="icon" onClick={() => onUpdate("lineHeight", Math.min(2.5, +(settings.lineHeight + 0.1).toFixed(1)))} aria-label={t("kids.reader.increaseLineHeight")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold">{t("kids.reader.background")}</span>
            <div role="group" aria-label={t("kids.reader.background")} className="mt-2 grid grid-cols-2 gap-2">
              {BACKGROUNDS.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.background === value}
                  onClick={() => onUpdate("background", value)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    settings.background === value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="kids-reader-focus" className="flex items-center gap-2 text-sm font-semibold">
              <Focus className="h-4 w-4" aria-hidden="true" /> {t("kids.reader.focusMode")}
            </Label>
            <Switch id="kids-reader-focus" checked={settings.focusMode} onCheckedChange={(v) => onUpdate("focusMode", v)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="kids-reader-autoscroll" className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4" aria-hidden="true" /> {t("kids.reader.autoScroll")}
            </Label>
            <Switch id="kids-reader-autoscroll" checked={settings.autoScroll} onCheckedChange={(v) => onUpdate("autoScroll", v)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
