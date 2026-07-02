import { useState } from "react";
import { Sparkles, Send, Briefcase, Newspaper, FileText, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { MOCK_PROFESSIONAL_PROFILE } from "./mock/mockProfile";
import type { FeedPostData, PostType } from "./types";

const TYPES: { type: PostType; labelKey: string; icon: typeof Briefcase }[] = [
  { type: "careerPost", labelKey: "networkUI.composer.type.careerPost", icon: Newspaper },
  { type: "hiringPost", labelKey: "networkUI.composer.type.hiringPost", icon: Briefcase },
  { type: "article", labelKey: "networkUI.composer.type.article", icon: FileText },
  { type: "poll", labelKey: "networkUI.composer.type.poll", icon: BarChart3 },
];

function draftFromPrompt(prompt: string): string {
  return `Excited to share a quick update: ${prompt}. Looking forward to connecting with others working on similar challenges! #career`;
}

function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(/#([A-Za-z0-9_]+)/g)).map((m) => m[1]);
}
function extractMentions(text: string): string[] {
  return Array.from(text.matchAll(/@([A-Za-z0-9_]+)/g)).map((m) => m[1]);
}

interface PostComposerProps {
  onPublish: (post: FeedPostData) => void;
}

export function PostComposer({ onPublish }: PostComposerProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [type, setType] = useState<PostType>("careerPost");
  const [content, setContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiWriter, setShowAiWriter] = useState(false);
  const writer = useAiSimulation(() => draftFromPrompt(aiPrompt), 1300);

  const applyDraft = () => {
    if (writer.result) setContent(writer.result);
  };

  const publish = () => {
    if (!content.trim()) return;
    playSound("success");
    onPublish({
      id: `post-${Date.now()}`,
      authorName: MOCK_PROFESSIONAL_PROFILE.fullName,
      authorHeadline: MOCK_PROFESSIONAL_PROFILE.headline,
      authorColor: MOCK_PROFESSIONAL_PROFILE.avatarColor,
      type,
      content: content.trim(),
      hashtags: extractHashtags(content),
      mentions: extractMentions(content),
      reactions: { like: 0, celebrate: 0, insightful: 0, support: 0 },
      userReaction: null,
      comments: [],
      bookmarked: false,
      shares: 0,
      date: new Date().toISOString().slice(0, 10),
      ...(type === "poll" ? { pollOptions: [{ id: "o1", label: t("networkUI.composer.pollOptionA"), votes: 0 }, { id: "o2", label: t("networkUI.composer.pollOptionB"), votes: 0 }] } : {}),
    });
    setContent("");
    setAiPrompt("");
    writer.reset();
  };

  return (
    <div className="net-glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={MOCK_PROFESSIONAL_PROFILE.fullName} color={MOCK_PROFESSIONAL_PROFILE.avatarColor} size="sm" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("networkUI.composer.placeholder")} rows={3} className="resize-none" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TYPES.map(({ type: tp, labelKey, icon: Icon }) => (
          <button
            key={tp}
            type="button"
            onClick={() => setType(tp)}
            aria-pressed={type === tp}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${type === tp ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setShowAiWriter((v) => !v)} aria-expanded={showAiWriter} className="flex items-center gap-1.5 self-start text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {t("networkUI.composer.aiWriter")}
      </button>

      {showAiWriter && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex gap-2">
            <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={t("networkUI.composer.aiWriterPlaceholder")} />
            <Button size="sm" onClick={writer.run} disabled={!aiPrompt.trim() || writer.loading}>{t("networkUI.composer.generate")}</Button>
          </div>
          {writer.loading && <div className="mt-2"><AIThinkingIndicator label={t("networkUI.composer.drafting")} /></div>}
          {writer.result && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="rounded-lg bg-background p-2 text-sm text-muted-foreground">{writer.result}</p>
              <Button size="sm" variant="outline" onClick={applyDraft} className="self-start">{t("networkUI.composer.useDraft")}</Button>
            </div>
          )}
        </div>
      )}

      <Button onClick={publish} disabled={!content.trim()} className="self-end">
        <Send className="me-2 h-4 w-4" aria-hidden="true" />
        {t("networkUI.composer.publish")}
      </Button>
    </div>
  );
}
