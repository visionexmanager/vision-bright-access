import { useState } from "react";
import { useParams } from "react-router-dom";
import { Clock3, Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useTimeline } from "@/hooks/library/useTimelines";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryTimelineDetail() {
  const { timelineId } = useParams<{ timelineId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { timeline, events, isLoading, addEvent, removeEvent } = useTimeline(timelineId);
  const [open, setOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  useDocumentHead({ title: timeline?.title ?? t("library.timelines.title") });

  const isOwner = !!user && timeline?.created_by === user.id;

  return (
    <Layout>
      <LibraryLayout
        title={timeline?.title ?? t("library.timelines.title")}
        breadcrumb={[{ label: t("library.timelines.title"), to: "/library/timelines" }, { label: timeline?.title ?? "" }]}
        headerActions={
          isOwner && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.timelines.addEvent")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.timelines.addEvent")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="ev-date">{t("library.timelines.eventDate")}</Label><Input id="ev-date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="1969, or March 1969" /></div>
                  <div><Label htmlFor="ev-title">{t("library.timelines.eventTitle")}</Label><Input id="ev-title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} /></div>
                  <div><Label htmlFor="ev-desc">{t("library.timelines.eventDescription")}</Label><Textarea id="ev-desc" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} rows={2} /></div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!eventDate.trim() || !eventTitle.trim()}
                    onClick={async () => {
                      await addEvent({ event_date_or_period: eventDate.trim(), title: eventTitle.trim(), description: eventDescription.trim() || null });
                      setOpen(false); setEventDate(""); setEventTitle(""); setEventDescription("");
                    }}
                  >
                    {t("library.timelines.addEvent")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        {timeline?.description && <p className="mb-6 text-muted-foreground">{timeline.description}</p>}

        {isLoading ? (
          <SkeletonLoader variant="list" count={4} />
        ) : events.length === 0 ? (
          <EmptyState icon={<Clock3 className="h-8 w-8" />} title={t("library.timelines.noEvents")} className="py-12" />
        ) : (
          <ol className="relative ms-3 space-y-6 border-s-2 ps-6">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -start-[31px] top-1 flex h-3.5 w-3.5 rounded-full bg-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-primary">{event.event_date_or_period}</p>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{event.title}</p>
                  {isOwner && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={() => void removeEvent(event.id)} aria-label={t("library.reviews.delete")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </LibraryLayout>
    </Layout>
  );
}
