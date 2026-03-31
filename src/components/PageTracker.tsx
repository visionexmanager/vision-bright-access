import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function PageTracker() {
  const location = useLocation();
  const lastPath = useRef("");

  useEffect(() => {
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    let sid = sessionStorage.getItem("vx_session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("vx_session_id", sid);
    }

    supabase.from("page_events" as any).insert({
      event_type: "page_view",
      page_path: location.pathname,
      page_title: document.title,
      session_id: sid,
    }).then(() => {});
  }, [location.pathname]);

  return null;
}
