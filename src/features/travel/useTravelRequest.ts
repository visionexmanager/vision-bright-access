/**
 * Sending a travel request, and everything that has to be true first.
 *
 * There is no new table here on purpose. `service_requests` is the queue the
 * travel desk already works from, and the existing Travel Agency page writes to
 * it — a second table would mean a second inbox, a second RLS policy and a
 * request nobody reads. What these pages add is structure: the desk receives a
 * filled itinerary instead of a paragraph.
 *
 * Nothing is charged. The concierge packages on `/services/travel-agency` cost
 * VX because a person builds an itinerary; asking for fares does not, and a
 * price on the question is a reason not to ask it.
 */

import { useCallback, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SERVICE_TYPE } from "@/features/travel/requests";

export type TravelRequestState = "idle" | "sending" | "sent" | "error";

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

export const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "" };

/**
 * Why a request could not be sent, in the terms the page has a sentence for.
 *
 * `signedOut` is not an error the traveller caused, and the page says so with a
 * link to sign in rather than a red box.
 */
export type TravelRequestFailure = "signedOut" | "contact" | "failed";

export interface UseTravelRequest {
  state: TravelRequestState;
  failure: TravelRequestFailure | null;
  send: (domain: keyof typeof SERVICE_TYPE, summary: string, contact: Contact) => Promise<boolean>;
  reset: () => void;
}

const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function useTravelRequest(): UseTravelRequest {
  const { user } = useAuth();
  const [state, setState] = useState<TravelRequestState>("idle");
  const [failure, setFailure] = useState<TravelRequestFailure | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setFailure(null);
  }, []);

  const send = useCallback(
    async (domain: keyof typeof SERVICE_TYPE, summary: string, contact: Contact) => {
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
        service_type: SERVICE_TYPE[domain],
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
