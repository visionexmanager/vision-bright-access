import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, VolumeX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyConversations, useMessages, useSendMessage, useMarkConversationRead } from "@/features/visionkids/hooks/social/useChat";
import { useProfiles, useMuteUser } from "@/features/visionkids/hooks/social/useFriends";
import { MessageThread } from "@/features/visionkids/components/social/MessageThread";
import { ReportDialog } from "@/features/visionkids/components/social/ReportDialog";

export default function ChatThread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);

  const { data: conversations = [] } = useMyConversations();
  const conversation = conversations.find((c) => c.id === conversationId);
  const otherId = conversation ? (conversation.user_a === user?.id ? conversation.user_b : conversation.user_a) : undefined;
  const { data: profiles = [] } = useProfiles(otherId ? [otherId] : []);
  const otherProfile = profiles[0];

  const { data: messages = [] } = useMessages(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId, user?.id);
  const muteUser = useMuteUser();

  useDocumentHead({ title: otherProfile ? `${otherProfile.display_name} — VisionKids` : t("kids.social.meta.title"), description: "", canonicalPath: `/kids/social/chat/${conversationId}` });

  useEffect(() => {
    if (conversationId && user?.id) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length]);

  const handleSend = (text: string) => {
    sendMessage.mutate(text, {
      onSuccess: (result) => { if (result.blocked) setBlockedNotice(true); },
    });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <Link to="/kids/social/chat" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {otherProfile?.display_name || t("kids.social.nav.safeChat")}
        </Link>
        <div className="flex gap-1">
          {otherId && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => muteUser.mutate(otherId)} aria-label={t("kids.social.friends.mute")}>
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {otherId && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setReportMessageId(otherId)} aria-label={t("kids.social.report.reportUser")}>
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {blockedNotice && (
        <p role="alert" className="mb-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{t("kids.social.chat.messageBlocked")}</p>
      )}

      <div className="flex-1 overflow-hidden rounded-2xl border-2 border-border">
        <MessageThread
          messages={messages.map((m) => ({ id: m.id, senderId: m.sender_id, content: m.content, isFlagged: m.is_flagged, wasFiltered: m.was_filtered, createdAt: m.created_at }))}
          onSend={handleSend}
          sending={sendMessage.isPending}
          onReport={(id) => setReportMessageId(id)}
        />
      </div>

      {reportMessageId && (
        <ReportDialog
          open={!!reportMessageId}
          onOpenChange={(o) => !o && setReportMessageId(null)}
          contentType={reportMessageId === otherId ? "kids_user" : "kids_message"}
          contentId={reportMessageId}
        />
      )}
    </div>
  );
}
