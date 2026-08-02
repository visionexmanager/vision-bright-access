import { useEffect, useState } from "react";
import { Accessibility, Gauge, Keyboard, Mic2, MonitorCog, Music2, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSound } from "@/contexts/SoundContext";
import { readGameSettings, saveGameSettings } from "./core/gameSettings";
import type { GameQualityMode, GameSettings } from "./core/types";
import { applyGraphicsProfile } from "./visual/graphicsQuality";

export function GameSettingsPanel() {
  const { setEnabled } = useSound();
  const [settings, setSettings] = useState<GameSettings>(readGameSettings);

  useEffect(() => {
    saveGameSettings(settings);
    setEnabled(!settings.muted);
    document.documentElement.classList.toggle("arcade-high-contrast", settings.highContrastMode);
    document.documentElement.classList.toggle("arcade-reduced-motion", settings.reducedMotion);
    applyGraphicsProfile();
  }, [settings, setEnabled]);

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const levels = [
    { key: "musicVolume" as const, label: "Music", icon: Music2 },
    { key: "effectsVolume" as const, label: "Effects", icon: Volume2 },
    { key: "voiceVolume" as const, label: "Voice", icon: Mic2 },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="gap-2 border-white/15 bg-black/20 text-white hover:bg-white/10 hover:text-white"><SlidersHorizontal className="h-4 w-4" />Settings</Button></PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80vh] w-[min(92vw,360px)] space-y-5 overflow-y-auto" aria-label="Game settings panel">
        <div className="flex items-center justify-between"><div><p className="font-semibold">Game settings</p><p className="text-xs text-muted-foreground">Applies across Visionex Arcade</p></div><Button size="icon" variant={settings.muted ? "destructive" : "outline"} onClick={() => update("muted", !settings.muted)} aria-label={settings.muted ? "Unmute all game audio" : "Mute all game audio"}>{settings.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button></div>
        <fieldset className="space-y-4"><legend className="mb-3 flex items-center gap-2 text-sm font-bold"><Volume2 className="h-4 w-4" />Audio</legend>{levels.map(({ key, label, icon: Icon }) => <div key={key} className="space-y-2"><div className="flex justify-between text-sm"><Label htmlFor={`arcade-${key}`} className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</Label><span>{settings.muted ? 0 : settings[key]}%</span></div><Slider id={`arcade-${key}`} value={[settings.muted ? 0 : settings[key]]} disabled={settings.muted} min={0} max={100} step={5} aria-label={`${label} volume`} onValueChange={([value]) => update(key, value)} /></div>)}<SettingSwitch id="hq-audio" label="High quality audio" icon={Music2} checked={settings.highQualityAudio} onChange={(value) => update("highQualityAudio", value)} /></fieldset>
        <div className="border-t pt-4"><Label htmlFor="arcade-quality" className="mb-2 flex items-center gap-2 text-sm font-bold"><MonitorCog className="h-4 w-4" />Display quality</Label><Select value={settings.qualityMode} onValueChange={(value) => update("qualityMode", value as GameQualityMode)}><SelectTrigger id="arcade-quality"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Automatic</SelectItem><SelectItem value="high">High quality</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="performance">Performance mode</SelectItem></SelectContent></Select></div>
        <fieldset className="space-y-3 border-t pt-4"><legend className="mb-2 flex items-center gap-2 text-sm font-bold"><Accessibility className="h-4 w-4" />Accessibility</legend><SettingSwitch id="keyboard-mode" label="Keyboard mode" icon={Keyboard} checked={settings.keyboardMode} onChange={(value) => update("keyboardMode", value)} /><SettingSwitch id="reader-mode" label="Screen reader mode" icon={Accessibility} checked={settings.screenReaderMode} onChange={(value) => update("screenReaderMode", value)} /><SettingSwitch id="contrast-mode" label="High contrast mode" icon={MonitorCog} checked={settings.highContrastMode} onChange={(value) => update("highContrastMode", value)} /><SettingSwitch id="motion-mode" label="Reduce motion" icon={Gauge} checked={settings.reducedMotion} onChange={(value) => update("reducedMotion", value)} /></fieldset>
      </PopoverContent>
    </Popover>
  );
}

function SettingSwitch({ id, label, icon: Icon, checked, onChange }: { id:string; label:string; icon:typeof Accessibility; checked:boolean; onChange:(value:boolean)=>void }) {
  return <div className="flex items-center justify-between gap-3"><Label htmlFor={id} className="flex items-center gap-2 text-sm font-normal"><Icon className="h-4 w-4 text-muted-foreground" />{label}</Label><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>;
}
