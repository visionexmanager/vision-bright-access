import { memo, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import {
  Lightbulb, Loader2, Send, Trash2,
  Copy, Check, ThumbsUp, ThumbsDown, Volume2,
  Maximize2, Minimize2, Square, Sparkles,
} from "lucide-react";
import { VoiceChat } from "@/components/VoiceChat";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";
import { AcademyErrorState } from "../ui/AcademyErrorState";
import type { ChatMessage, StudentProfile } from "@/lib/types";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="منير يكتب">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

interface QuickPrompt {
  icon: React.ReactNode;
  label: string;
  text: string;
}

interface AILearningCenterSectionProps {
  displayProfile: StudentProfile;
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoadingHistory: boolean;
  chatError: string | null;
  rateLimitCooldown: number;
  fullscreen: boolean;
  voiceMode: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  copiedId: string | null;
  feedback: Record<string, "up" | "down">;
  quickPrompts: QuickPrompt[];
  scrollRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  onToggleFullscreen: () => void;
  onClearChat: () => void;
  onAbortStream: () => void;
  onSend: (text: string) => void;
  onSpeak: (text: string) => void;
  onCopy: (id: string, text: string) => void;
  onFeedback: (id: string, vote: "up" | "down") => void;
  formatTime: (ts?: number) => string;
}

export const AILearningCenterSection = memo(function AILearningCenterSection({
  displayProfile,
  messages,
  isStreaming,
  isLoadingHistory,
  chatError,
  rateLimitCooldown,
  fullscreen,
  voiceMode,
  chatInput,
  setChatInput,
  copiedId,
  feedback,
  quickPrompts,
  scrollRef,
  inputRef,
  onToggleFullscreen,
  onClearChat,
  onAbortStream,
  onSend,
  onSpeak,
  onCopy,
  onFeedback,
  formatTime,
}: AILearningCenterSectionProps) {
  // Is the last message from the user and we haven't got first token yet?
  const waitingForFirstToken = isStreaming && messages[messages.length - 1]?.role === "user";

  return (
    <section id="ai-learning-center" aria-labelledby="ai-learning-heading">
      <AcademySectionHeader
        icon={Sparkles}
        title="مركز التعلّم الذكي"
        description="منير — مساعدك الأكاديمي بالذكاء الاصطناعي"
        headingId="ai-learning-heading"
      />

      {voiceMode && (
        <div className="mb-8">
          <VoiceChat
            assistant="munir"
            assistantName="منير — المساعد الأكاديمي"
            className="max-w-lg mx-auto"
          />
        </div>
      )}

      <div className={fullscreen ? "fixed inset-0 z-50 p-4 bg-background overflow-auto" : ""}>
        <div className={`bg-foreground rounded-3xl text-background relative shadow-2xl overflow-hidden ${fullscreen ? "flex flex-col h-full" : ""}`}>

          {/* Chat Header */}
          <div className="flex items-center justify-between p-5 md:p-7 border-b border-background/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-lg shrink-0" aria-hidden="true">
                <Lightbulb className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black leading-tight">منير — مساعد {displayProfile.level}</h3>
                <p className="text-primary text-[10px] font-bold uppercase tracking-widest">
                  {isStreaming ? "يكتب..." : "توجيه أكاديمي ذكي"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  onClick={onClearChat}
                  className="p-2 rounded-xl text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                  aria-label="مسح المحادثة"
                  title="مسح المحادثة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onToggleFullscreen}
                className="p-2 rounded-xl text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                aria-label={fullscreen ? "تصغير" : "تكبير"}
                title={fullscreen ? "تصغير" : "تكبير"}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className={`bg-background/5 backdrop-blur-xl border-b border-background/10 overflow-y-auto p-4 md:p-6 space-y-4 ${fullscreen ? "flex-1" : "max-h-[480px] min-h-[200px]"}`}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-atomic="false"
            aria-label="محادثة مع منير"
          >
            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-lg md:text-xl leading-relaxed font-medium text-center py-8 text-background/70">
                يا {displayProfile.name}، أنا منير 🧠 اسألني أي شي عن دروسك أو مستقبلك المهني!
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-start" : "items-end"}`}>
                  {/* Bubble */}
                  <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/10 text-background border border-background/10"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ms-0.5 align-middle rounded-sm" />}
                      </div>
                    ) : msg.content}

                    {/* Timestamp on hover */}
                    {msg.timestamp && (
                      <span className="absolute -bottom-5 text-[10px] text-background/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1">
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                  </div>

                  {/* Assistant action buttons */}
                  {msg.role === "assistant" && !msg.isStreaming && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* TTS */}
                      <button
                        onClick={() => onSpeak(msg.content)}
                        className="p-1.5 rounded-lg text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                        aria-label="استمع للرد"
                        title="استمع"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Copy */}
                      <button
                        onClick={() => onCopy(msg.id, msg.content)}
                        className="p-1.5 rounded-lg text-background/40 hover:text-background hover:bg-background/10 transition-colors"
                        aria-label="نسخ الرد"
                        title="نسخ"
                      >
                        {copiedId === msg.id
                          ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                      {/* Thumbs up */}
                      <button
                        onClick={() => onFeedback(msg.id, "up")}
                        className={`p-1.5 rounded-lg transition-colors ${feedback[msg.id] === "up" ? "text-emerald-400" : "text-background/40 hover:text-background hover:bg-background/10"}`}
                        aria-label="رد مفيد"
                        title="مفيد"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      {/* Thumbs down */}
                      <button
                        onClick={() => onFeedback(msg.id, "down")}
                        className={`p-1.5 rounded-lg transition-colors ${feedback[msg.id] === "down" ? "text-red-400" : "text-background/40 hover:text-background hover:bg-background/10"}`}
                        aria-label="رد غير مفيد"
                        title="غير مفيد"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Typing dots — waiting for first token */}
            {waitingForFirstToken && (
              <div className="flex justify-end">
                <div className="bg-background/10 rounded-2xl px-4 py-3 border border-background/10">
                  <TypingDots />
                </div>
              </div>
            )}

            {chatError && <AcademyErrorState message={chatError} className="text-background" />}
          </div>

          {/* Quick prompts — shown when chat is empty */}
          {messages.length === 0 && !isStreaming && (
            <div className="px-4 md:px-6 pt-4 flex flex-wrap gap-2">
              {quickPrompts.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onSend(p.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-background/10 hover:bg-background/20 border border-background/15 rounded-xl text-background/70 hover:text-background text-xs font-medium transition-all"
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Rate limit warning */}
          {rateLimitCooldown > 0 && (
            <p className="text-center text-xs text-background/50 pt-3 px-6">
              ⏳ انتظر {rateLimitCooldown} ثانية قبل إرسال رسالة جديدة
            </p>
          )}

          {/* Input */}
          <form
            className="p-4 md:p-6 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (isStreaming) { onAbortStream(); return; }
              onSend(chatInput);
            }}
          >
            <div className="relative">
              <input
                ref={inputRef}
                className="w-full p-4 pe-14 bg-background/10 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 text-background placeholder:text-background/30 transition-all text-sm md:text-base"
                placeholder="اسأل منير عن دروسك أو مستقبلك... (Enter للإرسال)"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={rateLimitCooldown > 0}
                aria-label="رسالة للمساعد منير"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (isStreaming) { onAbortStream(); return; }
                    onSend(chatInput);
                  }
                }}
              />
              <button
                type="submit"
                disabled={rateLimitCooldown > 0 || (!chatInput.trim() && !isStreaming)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground p-2.5 rounded-xl hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                aria-label={isStreaming ? "إيقاف" : "إرسال"}
                title={isStreaming ? "إيقاف" : "إرسال"}
              >
                {isStreaming
                  ? <Square className="w-4 h-4 fill-current" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
});
