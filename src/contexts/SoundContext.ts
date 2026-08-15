import { createContext, useContext } from "react";

// The provider lives in ./SoundProvider, together with the Web Audio engine
// it drives. Keeping the context and its hook in a module that exports no
// components is what lets both halves hot-reload.

// ─── Sound catalogue ──────────────────────────────────────────────────
export type UISoundType =
  | "navigate"
  | "click"
  | "success"
  | "error"
  | "hover"
  | "open"
  | "close"
  | "points"
  | "levelUp"
  | "achievement"
  | "send"
  | "receive"
  | "toggle"
  | "delete"
  | "refresh"
  | "tab"
  | "notification"
  | "complete"
  | "start"
  | "select"
  | "scan";

export type SoundContextType = {
  playSound: (sound: UISoundType) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

export const SoundContext = createContext<SoundContextType>({
  playSound: () => {},
  enabled: true,
  setEnabled: () => {},
});

export function useSound() {
  return useContext(SoundContext);
}
