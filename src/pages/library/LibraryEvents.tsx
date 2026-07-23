import { useState } from "react";
import { Calendar, Plus, Radio, Users, Mic2, Video, Presentation, PartyPopper, BookOpenCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useEvents, useEventRsvp } from "@/hooks/library/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryEventRow, LibraryEventType } from "@/services/library/events";

const EVENT_TYPES: LibraryEventType[] = ["author_qa", "book_launch", "reading_session", "live_audio", "webinar", "workshop", "meetup"];
const EVENT_ICON: Record<LibraryEventType, typeof Mic2> = {
  author_qa: Mic2, book_launch: PartyPopper, reading_session: BookOpenCheck, live_audio: Radio, webinar: Video, workshop: Presentation, meetup: Users,
};

function EventCard({ event }: { event: LibraryEventRow }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { myStatus, goingCount, rsvp, joinLiveRoom } = useEventRsvp(event.id);
  const Icon = EVENT_ICON[event.event_type];
  const isHost = user?.id === event.host_id;
  const isSoon = new Date(event.scheduled_start).getTime() - Date.now() < 15 * 60 * 1000;

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /></div>
          <div>
            <h3 className="font-semibold">{event.title}</h3>
            <p className="text-xs text-muted-foreground">{t(`library.events.type.${event.event_type}`)} · {event.hostName}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1 text-[10px]"><Users className="h-3 w-3" aria-hidden="true" /> {goingCount}</Badge>
      </div>
      {event.description && <p className="mb-2 text-sm text-muted-foreground">{event.description}</p>}
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" aria-hidden="true" /> {new Date(event.scheduled_start).toLocaleString()}</p>

      {user && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={myStatus === "going" ? "default" : "outline"} onClick={() => void rsvp("going")}>{t("library.events.rsvpGoing")}</Button>
          <Button size="sm" variant={myStatus === "interested" ? "default" : "outline"} onClick={() => void rsvp("interested")}>{t("library.events.rsvpInterested")}</Button>
          {(isHost || myStatus === "going") && isSoon && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void joinLiveRoom()}>
              <Radio className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.events.joinLive")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function LibraryEvents() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { events, isLoading, create } = useEvents();
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<LibraryEventType>("reading_session");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");

  useDocumentHead({ title: t("library.events.title") });

  return (
    <Layout>
      <LibraryLayout
        title={t("library.events.title")}
        breadcrumb={[{ label: t("library.events.title") }]}
        headerActions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.events.create")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.events.create")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>{t("library.events.typeLabel")}</Label>
                    <Select value={eventType} onValueChange={(v) => setEventType(v as LibraryEventType)}>
                      <SelectTrigger aria-label={t("library.events.typeLabel")}><SelectValue /></SelectTrigger>
                      <SelectContent>{EVENT_TYPES.map((et) => <SelectItem key={et} value={et}>{t(`library.events.type.${et}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="ev-title">{t("library.discussions.titleLabel")}</Label><Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><Label htmlFor="ev-desc">{t("library.clubs.descriptionLabel")}</Label><Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <div><Label htmlFor="ev-start">{t("library.events.scheduledStart")}</Label><Input id="ev-start" type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} /></div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!title.trim() || !scheduledStart}
                    onClick={async () => {
                      const event = await create({
                        event_type: eventType, title: title.trim(), description: description.trim() || null,
                        club_id: null, book_id: null, author_id: null,
                        scheduled_start: new Date(scheduledStart).toISOString(), scheduled_end: null, max_attendees: null,
                      });
                      if (event) { setOpen(false); setTitle(""); setDescription(""); setScheduledStart(""); }
                    }}
                  >
                    {t("library.events.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : events.length === 0 ? (
          <EmptyState icon={<Calendar className="h-10 w-10" />} title={t("library.events.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
