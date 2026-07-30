import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Users, LogOut, LogIn, FileText, ClipboardList, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useGroupBySlug, useGroupMembers, useMyGroupMemberships, useJoinGroup, useLeaveGroup,
  useGroupMessages, useSendGroupMessage, useGroupMaterials, useUploadGroupMaterial,
  useGroupAssignments, useCreateGroupAssignment, useMyAssignmentSubmission, useSubmitAssignment,
} from "@/features/visionkids/hooks/social/useGroups";
import { useQuizByGroup } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { MessageThread } from "@/features/visionkids/components/social/MessageThread";
import { ReportDialog } from "@/features/visionkids/components/social/ReportDialog";

export default function ClubDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);

  const { data: group, isLoading } = useGroupBySlug(slug);
  const { data: members = [] } = useGroupMembers(group?.id);
  const { data: myMemberships = [] } = useMyGroupMemberships();
  const isMember = !!group && myMemberships.some((m) => m.group_id === group.id);
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();

  const { data: messages = [] } = useGroupMessages(isMember ? group?.id : undefined);
  const sendMessage = useSendGroupMessage(group?.id);
  const { data: materials = [] } = useGroupMaterials(isMember ? group?.id : undefined);
  const uploadMaterial = useUploadGroupMaterial(group?.id);
  const { data: assignments = [] } = useGroupAssignments(isMember && group?.group_type === "study" ? group?.id : undefined);
  const createAssignment = useCreateGroupAssignment(group?.id);
  const { data: weeklyQuiz } = useQuizByGroup(isMember && group?.group_type === "reading" ? group?.id : undefined);

  useDocumentHead({
    title: group ? `${group.name} — VisionKids` : t("kids.social.meta.title"),
    description: group?.description ?? t("kids.social.meta.description"),
    canonicalPath: `/kids/social/clubs/detail/${slug}`,
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!group) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.social.clubs.notFound")}</p>
        <Link to="/kids/social" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6 sm:px-6">
      <Link to="/kids/social" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.social.heroTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-extrabold">
          <span aria-hidden="true">{group.emoji}</span> {group.name}
        </h1>
        {user && (
          isMember ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => leaveGroup.mutate(group.id)}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> {t("kids.social.clubs.leave")}
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => joinGroup.mutate(group.id)}>
              <LogIn className="h-4 w-4" aria-hidden="true" /> {t("kids.social.clubs.join")}
            </Button>
          )
        )}
      </div>
      {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {members.length}</p>

      {!isMember ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.clubs.joinToParticipate")}</p>
      ) : (
        <>
          {weeklyQuiz && (
            <Link
              to={`/kids/social/clubs/detail/${slug}/quiz`}
              className="mt-4 flex items-center justify-between rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-kids-accent" aria-hidden="true" /> {weeklyQuiz.title}</span>
              <span className="text-xs font-bold text-kids-accent">{t("kids.quiz.start")}</span>
            </Link>
          )}
        <Tabs defaultValue="chat" className="mt-4 flex flex-1 flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="chat">{t("kids.social.clubs.tabChat")}</TabsTrigger>
            <TabsTrigger value="materials">{t("kids.social.clubs.tabMaterials")}</TabsTrigger>
            {group.group_type === "study" && <TabsTrigger value="assignments">{t("kids.social.clubs.tabAssignments")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="chat" className="flex-1 overflow-hidden rounded-2xl border-2 border-border">
            <MessageThread
              messages={messages.map((m) => ({ id: m.id, senderId: m.user_id, content: m.content, isFlagged: m.is_flagged, wasFiltered: m.was_filtered, createdAt: m.created_at }))}
              onSend={(text) => sendMessage.mutate(text)}
              sending={sendMessage.isPending}
              onReport={(id) => setReportMessageId(id)}
            />
          </TabsContent>

          <TabsContent value="materials" className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2 py-3">
              {materials.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("kids.social.clubs.noMaterials")}</p>}
              {materials.map((m) => (
                <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                  <FileText className="h-4 w-4 text-kids-primary" aria-hidden="true" /> <span className="text-sm font-semibold">{m.title}</span>
                </a>
              ))}
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground hover:border-kids-primary/50">
                {t("kids.social.clubs.uploadMaterial")}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMaterial.mutate({ file, title: file.name });
                  }}
                />
              </label>
            </div>
          </TabsContent>

          {group.group_type === "study" && (
            <TabsContent value="assignments" className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2 py-3">
                {assignments.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("kids.social.clubs.noAssignments")}</p>}
                {assignments.map((a) => <AssignmentRow key={a.id} assignmentId={a.id} title={a.title} description={a.description} />)}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => {
                    const title = window.prompt(t("kids.social.clubs.assignmentTitlePrompt"));
                    if (title) createAssignment.mutate({ title });
                  }}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" /> {t("kids.social.clubs.newAssignment")}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
        </>
      )}

      {reportMessageId && (
        <ReportDialog open={!!reportMessageId} onOpenChange={(o) => !o && setReportMessageId(null)} contentType="kids_group_message" contentId={reportMessageId} />
      )}
    </div>
  );
}

function AssignmentRow({ assignmentId, title, description }: { assignmentId: string; title: string; description: string | null }) {
  const { t } = useLanguage();
  const { data: submission } = useMyAssignmentSubmission(assignmentId);
  const submitAssignment = useSubmitAssignment(assignmentId);
  const [content, setContent] = useState("");

  return (
    <div className="rounded-xl border-2 border-border bg-card p-3">
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {submission ? (
        <p className="mt-2 text-xs font-semibold text-kids-green">{t("kids.social.clubs.submitted")}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("kids.social.clubs.submissionPlaceholder")} rows={2} />
          <Button size="sm" onClick={() => submitAssignment.mutate(content)} disabled={!content.trim() || submitAssignment.isPending}>
            {t("kids.social.clubs.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}
