import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/features/visionkids/types/everywhere.types";

/** Live online/offline status from the browser. Components subscribe to react
 *  to connectivity (e.g. the ConnectionBadge, and the sync engine trigger). */
export function useConnection(): { status: ConnectionStatus; online: boolean } {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return { status: online ? "online" : "offline", online };
}
