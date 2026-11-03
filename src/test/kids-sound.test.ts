import { beforeEach, describe, expect, it, vi } from "vitest";
import { KIDS_SOUNDS, getKidsSoundEnabled, getKidsSpeechEnabled, playKidsSound, setKidsSoundEnabled, setKidsSpeechEnabled, speakKids } from "../features/visionkids/audio/kidsSound";

describe("VisionKids sounds", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("defaults: sounds on, automatic reading aloud off", () => {
    expect(getKidsSoundEnabled()).toBe(true);
    expect(getKidsSpeechEnabled()).toBe(false);
  });

  it("remembers the reader's choice", () => {
    setKidsSoundEnabled(false);
    setKidsSpeechEnabled(true);
    expect(getKidsSoundEnabled()).toBe(false);
    expect(getKidsSpeechEnabled()).toBe(true);
  });

  it("good news rises and bad news falls", () => {
    const first = (n: keyof typeof KIDS_SOUNDS) => KIDS_SOUNDS[n][0].f;
    const last = (n: keyof typeof KIDS_SOUNDS) => KIDS_SOUNDS[n][KIDS_SOUNDS[n].length - 1].f;
    expect(last("correct")).toBeGreaterThan(first("correct"));
    expect(last("win")).toBeGreaterThan(first("win"));
    expect(last("wrong")).toBeLessThan(first("wrong"));
    expect(last("lose")).toBeLessThan(first("lose"));
  });

  it("plays nothing, and never throws, when sounds are off or the browser has no audio", () => {
    expect(() => playKidsSound("correct")).not.toThrow();
    setKidsSoundEnabled(false);
    const ctor = vi.fn();
    (window as unknown as { AudioContext: unknown }).AudioContext = ctor;
    playKidsSound("win");
    expect(ctor).not.toHaveBeenCalled();
  });

  it("reads aloud in the asked language", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak, cancel };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} lang = ""; rate = 1; };
    speakKids("  ما هي  عاصمة لبنان؟ ", "ar");
    expect(speak).toHaveBeenCalledTimes(1);
    const said = speak.mock.calls[0][0] as { text: string; lang: string };
    expect(said.text).toBe("ما هي عاصمة لبنان؟");
    expect(said.lang).toBe("ar");
  });
});
