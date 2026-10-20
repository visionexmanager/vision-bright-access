import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AD_CONSENT_EVENT, readConsent } from "@/features/ads/consent";

// First-party page-view analytics. It records only after the visitor has accepted
// analytics in the cookie banner (the same record the advertising gate reads), and
// stops as soon as that is withdrawn. Without a choice, or with essential cookies
// only, nothing is written and nothing is stored in the browser, not even the
// per-tab session id.
const analyticsAllowed = () => readConsent()?.analytics === true;

export function PageTracker() {
  const location = useLocation();
  const lastPath = useRef("");
  const [allowed, setAllowed] = useState(analyticsAllowed);

  useEffect(() => {
    const sync = () => setAllowed(analyticsAllowed());
    window.addEventListener(AD_CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AD_CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    let sid: string | null = null;
    try {
      sid = sessionStorage.getItem("vx_session_id");
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem("vx_session_id", sid);
      }
    } catch {
      // Storage can be unavailable; record the view without a session id.
    }

    supabase.from("page_events").insert({
      event_type: "page_view",
      page_path: location.pathname,
      page_title: document.title,
      session_id: sid,
    }).then(() => {});
  }, [location.pathname, allowed]);

  return null;
}
