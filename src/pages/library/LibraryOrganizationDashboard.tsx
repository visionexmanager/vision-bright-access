import { useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpenCheck, Users, Clock, Percent, Loader2, Megaphone, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { OrganizationLayout } from "@/components/library/enterprise/OrganizationLayout";
import { useOrganizationAnalytics } from "@/hooks/library/useOrganizationAnalytics";
import { useOrganizationAnnouncements, useOrganizationCalendar } from "@/hooks/library/useOrganizationNotifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { useOrganization } from "@/hooks/library/useOrganization";

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

export default function LibraryOrganizationDashboard() {
  const { t } = useLanguage();
  const { slug = "" } = useParams<{ slug: string }>();

  useDocumentHead({ title: t("library.enterprise.title") });

  return (
    <OrganizationLayout slug={slug}>
      {(ctx) => <DashboardBody ctx={ctx} />}
    </OrganizationLayout>
  );
}

function DashboardBody({ ctx }: { ctx: ReturnType<typeof useOrganization> }) {
  const { t } = useLanguage();
  const organization = ctx.organization!;
  const orgId = organization.id;
  const { readingStats, popularBooks, certificatesEarned, isLoading } = useOrganizationAnalytics(orgId);
  const { isSending, send } = useOrganizationAnnouncements(orgId);
  const { exportIcs } = useOrganizationCalendar(orgId, organization.name);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportIcs}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.dashboard.exportCalendar")}
        </Button>
        {ctx.isAdmin && (
          <Dialog open={isAnnounceOpen} onOpenChange={setIsAnnounceOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.enterprise.dashboard.sendAnnouncement")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.enterprise.dashboard.sendAnnouncement")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="announce-title">{t("library.enterprise.dashboard.announcementTitle")}</Label>
                  <Input id="announce-title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="announce-body">{t("library.enterprise.dashboard.announcementBody")}</Label>
                  <Textarea id="announce-body" value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!announcementTitle.trim() || !announcementBody.trim() || isSending}
                  onClick={async () => {
                    const ok = await send(announcementTitle.trim(), announcementBody.trim());
                    if (ok) { setIsAnnounceOpen(false); setAnnouncementTitle(""); setAnnouncementBody(""); }
                  }}
                  className="gap-1.5"
                >
                  {isSending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {t("library.librarian.chat.send")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Clock} label={t("library.enterprise.dashboard.readingHours")} value={readingStats?.total_reading_hours ?? 0} />
        <StatCard icon={BookOpenCheck} label={t("library.enterprise.dashboard.booksCompleted")} value={readingStats?.total_books_completed ?? 0} />
        <StatCard icon={Users} label={t("library.enterprise.dashboard.activeMembers")} value={readingStats?.active_member_count ?? 0} />
        <StatCard icon={Percent} label={t("library.enterprise.dashboard.avgCompletion")} value={`${readingStats?.avg_completion_rate ?? 0}%`} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("library.enterprise.dashboard.popularBooks")}</h2>
        {popularBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("library.enterprise.dashboard.noData")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {popularBooks.map((b) => (
              <Card key={b.book_id} className="flex items-center justify-between gap-2 p-3">
                <span className="line-clamp-1 text-sm">{b.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t("library.enterprise.dashboard.readers").replace("{count}", String(b.reader_count))}</span>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="p-4">
        <p className="text-sm">{t("library.enterprise.dashboard.certificatesEarned").replace("{count}", String(certificatesEarned))}</p>
      </Card>
    </div>
  );
}
