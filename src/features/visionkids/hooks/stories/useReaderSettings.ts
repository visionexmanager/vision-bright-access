import { useEffect, useState, useCallback } from "react";
import type { ReaderSettings } from "@/features/visionkids/types/stories.types";

const STORAGE_KEY = "kids:reader-settings";

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 20,
  fontFamily: "sans",
  lineHeight: 1.7,
  background: "light",
  focusMode: false,
  autoScroll: false,
  autoScrollSpeed: 30,
};

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persisted across every story (a font-size preference isn't per-book). */
export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, update, reset };
}
