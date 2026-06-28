import { create }    from "zustand";
import { persist }   from "zustand/middleware";
import type { User } from "@/lib/api";
import { auth }      from "@/lib/api";

interface AuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  user:         User | null;
  isHydrated:   boolean;

  setTokens: (access: string, refresh: string) => void;
  setUser:   (user: User) => void;
  logout:    () => void;
  refresh:   () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,
      isHydrated:   false,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const tokens = await auth.refresh(refreshToken);
          set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
          return true;
        } catch {
          set({ accessToken: null, refreshToken: null, user: null });
          return false;
        }
      },
    }),
    {
      name:    "vx-auth",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
