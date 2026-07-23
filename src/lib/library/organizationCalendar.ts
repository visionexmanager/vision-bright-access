/**
 * Organization Calendar — ICS (iCalendar) export. No site-wide calendar or
 * ICS export exists anywhere else in this app (confirmed by research) — a
 * plain-text format, built here with no new dependency.
 */

export interface OrganizationCalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  scheduledStart: string;
  scheduledEnd?: string | null;
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildOrganizationIcs(organizationName: string, events: OrganizationCalendarEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Visionex//${escapeIcsText(organizationName)} Calendar//EN`];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@visionex.app`,
      `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
      `DTSTART:${toIcsDate(event.scheduledStart)}`,
      ...(event.scheduledEnd ? [`DTEND:${toIcsDate(event.scheduledEnd)}`] : []),
      `SUMMARY:${escapeIcsText(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadOrganizationIcs(organizationName: string, events: OrganizationCalendarEvent[]) {
  const ics = buildOrganizationIcs(organizationName, events);
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${organizationName.replace(/[^\w\- ]/g, "").trim() || "organization"}-calendar.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
