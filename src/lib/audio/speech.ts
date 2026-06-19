const VOICE_SESSION_EVENT = "visionex:voice-session-start";

export function cancelSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function speakText(
  text: string,
  lang: string,
  options: { rate?: number; volume?: number; onEnd?: () => void } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  window.dispatchEvent(new CustomEvent(VOICE_SESSION_EVENT));
  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = normalizeSpeechLang(lang);
  utterance.rate = options.rate ?? 0.9;
  utterance.volume = options.volume ?? 1;
  utterance.onend = options.onEnd ?? null;
  utterance.onerror = options.onEnd ?? null;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function normalizeSpeechLang(lang: string) {
  if (lang === "ar") return "ar-SA";
  if (lang === "ur") return "ur-PK";
  if (lang === "hi") return "hi-IN";
  if (lang === "zh") return "zh-CN";
  if (lang === "pt") return "pt-BR";
  return lang?.includes("-") ? lang : "en-US";
}

export { VOICE_SESSION_EVENT };
