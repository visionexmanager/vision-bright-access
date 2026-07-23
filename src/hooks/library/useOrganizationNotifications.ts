import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { sendOrganizationAnnouncement, fetchOrganizationCalendarEvents } from "@/services/library/organizationNotifications";
import { downloadOrganizationIcs } from "@/lib/library/organizationCalendar";

export function useOrganizationAnnouncements(orgId: string) {
  const [isSending, setIsSending] = useState(false);

  const send = async (title: string, body: string) => {
    setIsSending(true);
    try {
      const count = await sendOrganizationAnnouncement(orgId, title, body);
      toast({ title: `Announcement sent to ${count} member${count === 1 ? "" : "s"}` });
      return true;
    } catch (err) {
      toast({ title: "Couldn't send announcement", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, send };
}

export function useOrganizationCalendar(orgId: string, organizationName: string) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.organization(orgId), "calendar-events"],
    queryFn: () => fetchOrganizationCalendarEvents(orgId),
    enabled: !!orgId,
  });

  const exportIcs = () => downloadOrganizationIcs(organizationName, events);

  return { events, isLoading, exportIcs };
}
