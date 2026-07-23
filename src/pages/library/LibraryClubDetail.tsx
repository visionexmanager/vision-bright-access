import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Users, Megaphone, Calendar, MessageSquare, Settings, Mail, Shield, Ban, Crown, GraduationCap } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { DiscussionBoard } from "@/components/library/community/DiscussionBoard";
import { GroupLearningTab } from "@/components/library/learning/GroupLearningTab";
import { ReportContentDialog } from "@/components/library/ReportContentDialog";
import { useClub } from "@/hooks/library/useClub";
import { useClubAnnouncements, useClubSchedule } from "@/hooks/library/useClubExtras";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { fetchCatalog } from "@/services/library/catalog";
import type { LibraryBookRow } from "@/lib/types/library-book";

function AnnouncementsTab({ clubId, isModerator }: { clubId: string; isModerator: boolean }) {
  const { t } = useLanguage();
  const { announcements, isLoading, create, remove } = useClubAnnouncements(clubId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  return (
    <div className="space-y-4">
      {isModerator && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Megaphone className="h-4 w-4" aria-hidden="true" /> {t("library.clubs.newAnnouncement")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("library.clubs.newAnnouncement")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label htmlFor="ann-title">{t("library.discussions.titleLabel")}</Label><Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label htmlFor="ann-body">{t("library.discussions.bodyLabel")}</Label><Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} /></div>
              <div className="flex items-center gap-2"><Checkbox id="ann-pin" checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} /><Label htmlFor="ann-pin" className="font-normal">{t("library.discussions.pin")}</Label></div>
            </div>
            <DialogFooter>
              <Button
                disabled={!title.trim() || !body.trim()}
                onClick={async () => { await create(title, body, isPinned); setOpen(false); setTitle(""); setBody(""); setIsPinned(false); }}
              >
                {t("library.discussions.post")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {isLoading ? <SkeletonLoader variant="list" count={2} /> : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title={t("library.clubs.noAnnouncements")} className="py-8" />
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">{a.is_pinned && <Badge variant="secondary" className="text-[10px]">{t("library.discussions.pin")}</Badge>} {a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
                {isModerator && <Button variant="ghost" size="sm" className="h-6 shrink-0 text-xs text-destructive" onClick={() => void remove(a.id)}>{t("library.common.delete")}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ clubId, isModerator }: { clubId: string; isModerator: boolean }) {
  const { t } = useLanguage();
  const { schedule, currentSchedule, progress, setCurrentBook } = useClubSchedule(clubId);
  const [open, setOpen] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [results, setResults] = useState<LibraryBookRow[]>([]);
  const [selectedBook, setSelectedBook] = useState<LibraryBookRow | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [targetDescription, setTargetDescription] = useState("");

  return (
    <div className="space-y-4">
      {isModerator && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Calendar className="h-4 w-4" aria-hidden="true" /> {t("library.clubs.setCurrentBook")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("library.clubs.setCurrentBook")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                onKeyDown={async (e) => { if (e.key === "Enter" && bookQuery.trim()) setResults(await fetchCatalog({ query: bookQuery.trim(), limit: 6 })); }}
                placeholder={t("library.collectionsAdmin.searchBooksPlaceholder")}
              />
              {results.length > 0 && (
                <ul className="space-y-1">
                  {results.map((b) => (
                    <li key={b.id}>
                      <button type="button" onClick={() => setSelectedBook(b)} className={`w-full rounded-md border p-2 text-start text-sm ${selectedBook?.id === b.id ? "border-primary" : ""}`}>
                        {b.title} — {b.author_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="sched-start">{t("library.clubs.startDate")}</Label><Input id="sched-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div><Label htmlFor="sched-end">{t("library.clubs.endDate")}</Label><Input id="sched-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              </div>
              <div><Label htmlFor="sched-target">{t("library.clubs.targetDescription")}</Label><Input id="sched-target" value={targetDescription} onChange={(e) => setTargetDescription(e.target.value)} placeholder="Chapters 1-5 by Friday" /></div>
            </div>
            <DialogFooter>
              <Button
                disabled={!selectedBook}
                onClick={async () => {
                  if (!selectedBook) return;
                  await setCurrentBook(selectedBook.id, startDate, endDate || null, targetDescription || null);
                  setOpen(false);
                  setSelectedBook(null);
                  setResults([]);
                  setBookQuery("");
                }}
              >
                {t("library.common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {currentSchedule ? (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("library.clubs.currentlyReading")}</p>
          <h3 className="text-lg font-semibold">{currentSchedule.book_title}</h3>
          {currentSchedule.target_description && <p className="text-sm text-muted-foreground">{currentSchedule.target_description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {currentSchedule.start_date}{currentSchedule.end_date ? ` – ${currentSchedule.end_date}` : ""}
          </p>

          {progress.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {progress.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 truncate">{p.display_name}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${p.percent_complete}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-end text-xs text-muted-foreground">{Math.round(p.percent_complete)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <EmptyState icon={<Calendar className="h-8 w-8" />} title={t("library.clubs.noCurrentBook")} className="py-8" />
      )}

      {schedule.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("library.clubs.pastReads")}</p>
          <ul className="space-y-1">
            {schedule.filter((s) => !s.is_current).map((s) => (
              <li key={s.id} className="text-sm text-muted-foreground">{s.book_title} ({s.start_date})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MembersTab({ clubId, members, isOwner, isModerator, approveRequest, setRole, setBan }: {
  clubId: string;
  members: ReturnType<typeof useClub>["members"];
  isOwner: boolean;
  isModerator: boolean;
  approveRequest: (userId: string, approve: boolean) => void;
  setRole: (userId: string, role: "moderator" | "member") => void;
  setBan: (userId: string, banned: boolean) => void;
}) {
  const { t } = useLanguage();
  const active = members.filter((m) => m.status === "active");
  const requested = members.filter((m) => m.status === "requested");

  return (
    <div className="space-y-4">
      {isModerator && requested.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("library.clubs.pendingRequests")}</p>
          <ul className="space-y-1.5">
            {requested.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>{m.displayName}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7" onClick={() => approveRequest(m.user_id, true)}>{t("library.importReview.approve")}</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => approveRequest(m.user_id, false)}>{t("library.importReview.reject")}</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-1.5">
        {active.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <Link to={`/library/profile/${m.user_id}`} className="flex items-center gap-2">
              <Avatar className="h-6 w-6"><AvatarImage src={m.avatarUrl ?? undefined} alt="" /><AvatarFallback>{m.displayName.slice(0, 1)}</AvatarFallback></Avatar>
              <span>{m.displayName}</span>
              {m.role === "owner" && <Crown className="h-3 w-3 text-amber-500" aria-hidden="true" />}
              {m.role === "moderator" && <Shield className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
            </Link>
            {isOwner && m.role !== "owner" && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setRole(m.user_id, m.role === "moderator" ? "member" : "moderator")}>
                  {m.role === "moderator" ? t("library.clubs.demote") : t("library.clubs.promote")}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => setBan(m.user_id, true)}><Ban className="h-3 w-3" aria-hidden="true" /></Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LibraryClubDetail() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const {
    club, members, myMembership, isMember, isModerator, isOwner, isLoading,
    join, leave, invite, approveRequest, setRole, setBan,
  } = useClub(slug);
  const [inviteEmail, setInviteEmail] = useState("");

  useDocumentHead({ title: club ? club.name : t("library.clubs.title") });

  return (
    <Layout>
      <LibraryLayout title={club?.name ?? t("library.clubs.title")} breadcrumb={[{ label: t("library.clubs.title"), to: "/library/clubs" }, ...(club ? [{ label: club.name }] : [])]}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !club ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title={t("library.clubs.notFound")} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{club.name}</h2>
                {club.description && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{club.description}</p>}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" aria-hidden="true" /> {club.member_count} {t("library.clubs.members")}</p>
              </div>
              <div className="flex gap-2">
                {isModerator && (
                  <Dialog>
                    <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.clubs.invite")}</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t("library.clubs.invite")}</DialogTitle></DialogHeader>
                      <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t("library.readingLists.shareEmailPlaceholder")} type="email" />
                      <DialogFooter>
                        <Button onClick={() => { void invite(inviteEmail); setInviteEmail(""); }} disabled={!inviteEmail.trim()}>{t("library.readingLists.shareAction")}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {user && !isOwner && (
                  isMember ? (
                    <Button size="sm" variant="outline" onClick={() => void leave()}>{t("library.clubs.leave")}</Button>
                  ) : myMembership?.status === "requested" ? (
                    <Button size="sm" variant="outline" disabled>{t("library.clubs.requestPending")}</Button>
                  ) : myMembership?.status === "banned" ? null : (
                    <Button size="sm" onClick={() => void join()}>{t("library.clubs.join")}</Button>
                  )
                )}
                {user && <ReportContentDialog contentType="library_club" contentId={club.id} iconOnly />}
              </div>
            </div>

            <Tabs defaultValue="discussions">
              <TabsList>
                <TabsTrigger value="discussions"><MessageSquare className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.discussions.title")}</TabsTrigger>
                <TabsTrigger value="schedule"><Calendar className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.clubs.schedule")}</TabsTrigger>
                <TabsTrigger value="announcements"><Megaphone className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.clubs.announcements")}</TabsTrigger>
                <TabsTrigger value="learning"><GraduationCap className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.learningHub.title")}</TabsTrigger>
                <TabsTrigger value="members"><Users className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.clubs.members")}</TabsTrigger>
                {club.rules && <TabsTrigger value="rules"><Settings className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t("library.clubs.rules")}</TabsTrigger>}
              </TabsList>

              <TabsContent value="discussions">
                {isMember ? <DiscussionBoard contextType="club" contextId={club.id} canModerate={isModerator} /> : <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t("library.clubs.joinToView")} className="py-8" />}
              </TabsContent>
              <TabsContent value="schedule">
                {isMember ? <ScheduleTab clubId={club.id} isModerator={isModerator} /> : <EmptyState icon={<Calendar className="h-8 w-8" />} title={t("library.clubs.joinToView")} className="py-8" />}
              </TabsContent>
              <TabsContent value="announcements">
                {isMember ? <AnnouncementsTab clubId={club.id} isModerator={isModerator} /> : <EmptyState icon={<Megaphone className="h-8 w-8" />} title={t("library.clubs.joinToView")} className="py-8" />}
              </TabsContent>
              <TabsContent value="learning">
                {isMember ? <GroupLearningTab clubId={club.id} isModerator={isModerator} /> : <EmptyState icon={<GraduationCap className="h-8 w-8" />} title={t("library.clubs.joinToView")} className="py-8" />}
              </TabsContent>
              <TabsContent value="members">
                <MembersTab clubId={club.id} members={members} isOwner={isOwner} isModerator={isModerator} approveRequest={(u, a) => void approveRequest(u, a)} setRole={(u, r) => void setRole(u, r)} setBan={(u, b) => void setBan(u, b)} />
              </TabsContent>
              {club.rules && <TabsContent value="rules"><Card className="whitespace-pre-wrap p-4 text-sm">{club.rules}</Card></TabsContent>}
            </Tabs>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
