import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useConversations,
  useDirectMessages,
  findOrCreateConversation,
  type Conversation,
} from "@/hooks/useMessages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Plus,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

export default function Messages() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-primary" />
            {t("msg.title")}
          </h1>
          <NewConversationDialog
            userId={user.id}
            onCreated={(convId) => setActiveConvId(convId)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <ConversationList
            activeConvId={activeConvId}
            onSelect={setActiveConvId}
            userId={user.id}
          />
          <ChatView
            conversationId={activeConvId}
            userId={user.id}
            onBack={() => setActiveConvId(null)}
          />
        </div>
      </section>
    </Layout>
  );
}

function ConversationList({
  activeConvId,
  onSelect,
  userId,
}: {
  activeConvId: string | null;
  onSelect: (id: string) => void;
  userId: string;
}) {
  const { conversations, loading } = useConversations();
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card className="md:block">
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${activeConvId ? "hidden md:block" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t("msg.conversations")}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="max-h-[60vh]">
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              {t("msg.noConversations")}
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-center gap-3 rounded-lg p-3 text-start transition-colors hover:bg-muted ${
                  activeConvId === conv.id ? "bg-primary/10" : ""
                }`}
              >
                <Avatar className="h-10 w-10">
                  {conv.other_user?.avatar_url && (
                    <AvatarImage src={conv.other_user.avatar_url} />
                  )}
                  <AvatarFallback>
                    {(conv.other_user?.display_name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {conv.other_user?.display_name || t("msg.unknownUser")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message_text || t("msg.noMessages")}
                  </p>
                </div>
                {conv.last_message_at && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(conv.last_message_at).toLocaleDateString()}
                  </span>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ChatView({
  conversationId,
  userId,
  onBack,
}: {
  conversationId: string | null;
  userId: string;
  onBack: () => void;
}) {
  const { messages, loading, sendMessage } = useDirectMessages(conversationId);
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversationId) {
    return (
      <Card className="hidden md:flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>{t("msg.selectConversation")}</p>
        </div>
      </Card>
    );
  }

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await sendMessage(text);
    setText("");
    setSending(false);
  };

  return (
    <Card className={`flex flex-col ${!conversationId ? "hidden md:flex" : ""}`}>
      <CardHeader className="flex-row items-center gap-2 pb-2 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <CardTitle className="text-lg">{t("msg.chat")}</CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1 min-h-[300px] max-h-[55vh] p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-3/4" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("msg.startConversation")}
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === userId;
            return (
              <div
                key={msg.id}
                className={`flex mb-3 ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <span
                    className={`block text-[10px] mt-1 ${
                      isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={t("msg.typePlaceholder")}
          disabled={sending}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function NewConversationDialog({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (convId: string) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .neq("user_id", userId)
      .ilike("display_name", `%${search.trim()}%`)
      .limit(10);
    setResults(data || []);
    setSearching(false);
  };

  const startConversation = async (otherUserId: string) => {
    try {
      const convId = await findOrCreateConversation(userId, otherUserId);
      onCreated(convId);
      setOpen(false);
      setSearch("");
      setResults([]);
    } catch {
      toast.error(t("msg.errorCreating"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="me-2 h-4 w-4" />
          {t("msg.newMessage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("msg.newConversation")}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t("msg.searchUsers")}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={searching} size="icon" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-60 mt-2">
          {results.length === 0 && !searching && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("msg.searchPrompt")}
            </p>
          )}
          {results.map((p) => (
            <button
              key={p.user_id}
              onClick={() => startConversation(p.user_id)}
              className="w-full flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors"
            >
              <Avatar className="h-9 w-9">
                {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">
                {p.display_name || "User"}
              </span>
            </button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
