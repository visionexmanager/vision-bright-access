import { cancelSpeech, speakText } from "@/lib/audio/speech";
import { readGameSettings } from "../core/gameSettings";

type AccessibleEvent = "instructions" | "status" | "focus" | "success" | "failure" | "warning";

export class AccessibilityAudioLayer {
  private lastMessage = "";
  private lastAt = 0;

  announce(message: string, type: AccessibleEvent = "status", lang = document.documentElement.lang || "en") {
    const settings = readGameSettings();
    if (!settings.screenReaderMode || !message.trim()) return;
    const now = Date.now();
    if (message === this.lastMessage && now - this.lastAt < 1200) return;
    this.lastMessage = message; this.lastAt = now;
    if (["success","failure","warning","instructions"].includes(type)) cancelSpeech();
    speakText(message, lang);
  }

  describeState(gameName: string, score: number, status: string) {
    this.announce(`${gameName}. Status: ${status}. Current score: ${score}.`, "status");
  }

  stop() { cancelSpeech(); }
}

export const accessibilityAudio = new AccessibilityAudioLayer();
