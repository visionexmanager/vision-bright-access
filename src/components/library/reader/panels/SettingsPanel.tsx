import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryReaderSettings } from "@/lib/types/library-reader";

interface SettingsPanelProps {
  settings: LibraryReaderSettings;
  onChange: (patch: Partial<LibraryReaderSettings>) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-5">
      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.fontSize")}</Label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onChange({ fontSize: Math.max(12, settings.fontSize - 1) })} aria-label={t("library.reader.decreaseFont")}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="w-10 text-center text-sm" aria-live="polite">{settings.fontSize}px</span>
          <Button variant="outline" size="icon" onClick={() => onChange({ fontSize: Math.min(32, settings.fontSize + 1) })} aria-label={t("library.reader.increaseFont")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.fontFamily")}</Label>
        <Select value={settings.fontFamily} onValueChange={(v) => onChange({ fontFamily: v as LibraryReaderSettings["fontFamily"] })}>
          <SelectTrigger aria-label={t("library.reader.fontFamily")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="serif">{t("library.reader.fontFamily.serif")}</SelectItem>
            <SelectItem value="sans">{t("library.reader.fontFamily.sans")}</SelectItem>
            <SelectItem value="dyslexic">{t("library.reader.fontFamily.dyslexic")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.fontWeight")}</Label>
        <Select value={settings.fontWeight} onValueChange={(v) => onChange({ fontWeight: v as LibraryReaderSettings["fontWeight"] })}>
          <SelectTrigger aria-label={t("library.reader.fontWeight")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">{t("library.reader.fontWeight.normal")}</SelectItem>
            <SelectItem value="bold">{t("library.reader.fontWeight.bold")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.lineSpacing")}</Label>
        <Slider value={[settings.lineSpacing]} min={1.2} max={2.4} step={0.1} onValueChange={([v]) => onChange({ lineSpacing: v })} aria-label={t("library.reader.lineSpacing")} />
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.margins")}</Label>
        <Select value={settings.margins} onValueChange={(v) => onChange({ margins: v as LibraryReaderSettings["margins"] })}>
          <SelectTrigger aria-label={t("library.reader.margins")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="narrow">{t("library.explorer.viewCompact")}</SelectItem>
            <SelectItem value="normal">{t("library.reader.normal")}</SelectItem>
            <SelectItem value="wide">{t("library.reader.wide")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.pageWidth")}</Label>
        <Select value={settings.pageWidth} onValueChange={(v) => onChange({ pageWidth: v as LibraryReaderSettings["pageWidth"] })}>
          <SelectTrigger aria-label={t("library.reader.pageWidth")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="narrow">{t("library.explorer.viewCompact")}</SelectItem>
            <SelectItem value="normal">{t("library.reader.normal")}</SelectItem>
            <SelectItem value="wide">{t("library.reader.wide")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.theme")}</Label>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "sepia", "high-contrast"] as const).map((theme) => (
            <Button key={theme} variant={settings.theme === theme ? "default" : "outline"} size="sm" onClick={() => onChange({ theme })} aria-pressed={settings.theme === theme}>
              {t(`library.reader.theme.${theme}`)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.scrollMode")}</Label>
        <div className="flex gap-2">
          <Button variant={settings.scrollMode === "vertical" ? "default" : "outline"} size="sm" onClick={() => onChange({ scrollMode: "vertical" })} aria-pressed={settings.scrollMode === "vertical"}>
            {t("library.reader.scrollMode.vertical")}
          </Button>
          <Button variant={settings.scrollMode === "horizontal-paginated" ? "default" : "outline"} size="sm" onClick={() => onChange({ scrollMode: "horizontal-paginated" })} aria-pressed={settings.scrollMode === "horizontal-paginated"}>
            {t("library.reader.scrollMode.paginated")}
          </Button>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm">{t("library.reader.pageLayout")}</Label>
        <div className="flex gap-2">
          <Button variant={settings.pageLayout === "single" ? "default" : "outline"} size="sm" onClick={() => onChange({ pageLayout: "single" })} aria-pressed={settings.pageLayout === "single"}>
            {t("library.reader.pageLayout.single")}
          </Button>
          <Button variant={settings.pageLayout === "double" ? "default" : "outline"} size="sm" onClick={() => onChange({ pageLayout: "double" })} aria-pressed={settings.pageLayout === "double"}>
            {t("library.reader.pageLayout.double")}
          </Button>
        </div>
      </div>
    </div>
  );
}
