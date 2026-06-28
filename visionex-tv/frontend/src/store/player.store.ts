import { create }    from "zustand";
import { persist }   from "zustand/middleware";
import type { Channel, StreamSession } from "@/lib/api";

type PlayerStatus = "idle" | "loading" | "playing" | "buffering" | "error" | "switching";

interface PlayerState {
  // Current channel
  channel:      Channel | null;
  session:      StreamSession | null;
  status:       PlayerStatus;
  errorMessage: string | null;

  // Playback preferences
  volume:       number;
  muted:        boolean;
  quality:      string;

  // History (last 20 channels)
  lastChannel:  Channel | null;
  recentIds:    string[];

  // Actions
  setChannel:   (ch: Channel) => void;
  setSession:   (s: StreamSession) => void;
  setStatus:    (s: PlayerStatus) => void;
  setError:     (msg: string | null) => void;
  setVolume:    (v: number) => void;
  setMuted:     (m: boolean) => void;
  clearSession: () => void;
  addToRecent:  (id: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      channel:      null,
      session:      null,
      status:       "idle",
      errorMessage: null,
      volume:       80,
      muted:        false,
      quality:      "auto",
      lastChannel:  null,
      recentIds:    [],

      setChannel: (ch) => set({ channel: ch, lastChannel: ch }),

      setSession: (s) => set({ session: s }),

      setStatus: (status) => set({ status, errorMessage: status !== "error" ? null : get().errorMessage }),

      setError: (msg) => set({ errorMessage: msg, status: msg ? "error" : "idle" }),

      setVolume: (v) => set({ volume: v, muted: v === 0 }),

      setMuted: (m) => set({ muted: m }),

      clearSession: () => set({ session: null, status: "idle", errorMessage: null }),

      addToRecent: (id) =>
        set((state) => ({
          recentIds: [id, ...state.recentIds.filter(x => x !== id)].slice(0, 20),
        })),
    }),
    {
      name:    "vx-player",
      version: 1,
      partialize: (s) => ({
        volume:     s.volume,
        muted:      s.muted,
        quality:    s.quality,
        lastChannel: s.lastChannel,
        recentIds:  s.recentIds,
      }),
    }
  )
);
