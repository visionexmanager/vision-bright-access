import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function getSessionId(): string {
  let sid = sessionStorage.getItem("vx_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("vx_session_id", sid);
  }
  return sid;
}

export function usePageTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const lastPath = useRef("");

  useEffect(() => {
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    supabase.from("page_events").insert({
      event_type: "page_view",
      page_path: location.pathname,
      page_title: document.title,
      user_id: user?.id ?? null,
      session_id: getSessionId(),
    } as any).then(() => {});
  }, [location.pathname, user?.id]);
}

export function trackEvent(eventType: string, pagePath: string, metadata?: Record<string, any>) {
  supabase.from("page_events").insert({
    event_type: eventType,
    page_path: pagePath,
    metadata: metadata ?? {},
    session_id: getSessionId(),
  } as any).then(() => {});
}
