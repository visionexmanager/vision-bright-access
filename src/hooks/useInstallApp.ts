/**
 * Installing the site as an app.
 *
 * Chrome and Edge (desktop and Android) offer an install prompt through
 * `beforeinstallprompt`; the event is held until the visitor presses our button.
 * Safari on iPhone and iPad has no such event — the only route is Share → Add to
 * Home Screen — so there the button explains it instead.
 *
 * Nothing is offered once the site already runs as an installed app.
 */

import { useCallback, useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "prompt" | "ios" | "none";

const isStandalone = (): boolean => {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

/** iPhone, iPad, and iPadOS 13+ which reports itself as a Mac with a touch screen. */
const isIos = (): boolean => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

export function useInstallApp(): { mode: InstallMode; install: () => Promise<void> } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => typeof window !== "undefined" && isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    setEvent(null);
  }, [event]);

  const mode: InstallMode = installed ? "none" : event ? "prompt" : typeof window !== "undefined" && isIos() ? "ios" : "none";
  return { mode, install };
}
