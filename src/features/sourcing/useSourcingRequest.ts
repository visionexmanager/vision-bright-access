import { useCallback, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SERVICE_TYPE, type SourcingRoute } from "@/features/sourcing/requests";
import type { Contact } from "@/features/travel/useTravelRequest";

export type SourcingState = "idle" | "sending" | "sent" | "error";
export type SourcingFailure = "signedOut" | "contact" | "failed";

const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Files the request into `service_requests` as the signed-in user's own row. */
export function useSourcingRequest() {
  const { user } = useAuth();
  const [state, setState] = useState<SourcingState>("idle");
  const [failure, setFailure] = useState<SourcingFailure | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setFailure(null);
  }, []);

  const send = useCallback(
    async (route: SourcingRoute, summary: string, contact: Contact) => {
      if (!user) {
        setFailure("signedOut");
        setState("error");
        return false;
      }
      if (!contact.name.trim() || !looksLikeEmail(contact.email)) {
        setFailure("contact");
        setState("error");
        return false;
      }
      setState("sending");
      setFailure(null);
      const { error } = await supabase.from("service_requests").insert({
        user_id: user.id,
        full_name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || null,
        service_type: SERVICE_TYPE[route],
        message: summary,
        status: "pending",
      });
      if (error) {
        setFailure("failed");
        setState("error");
        return false;
      }
      setState("sent");
      return true;
    },
    [user],
  );

  return { state, failure, send, reset };
}
