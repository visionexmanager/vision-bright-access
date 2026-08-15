import { createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";

// The provider lives in ./AuthProvider. Keeping the context and its hook in a
// module that exports no components is what lets both halves hot-reload —
// and useAuth is imported in hundreds of files, so it is the half that stays.

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
