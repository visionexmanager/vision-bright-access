/**
 * useAIChat — General-purpose AI chat hook.
 *
 * Uses aiService.streamChat() (AI Service Layer) +
 * useSSEStream (shared SSE parser) — no direct fetch allowed here.
 */
import { useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { aiService } from "@/services/ai/aiService";
import {
  buildCompanionPageContext,
  clearServerCompanionMemory,
  loadCompanionMemory,
  runCompanionTool,
  saveCompanionMemory,
  setCompanionMemoryEnabled,
  type CompanionMemory,
} from "@/lib/ai/companion";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type RateLimitInfo = {
  isRateLimited: boolean;
  cooldownSeconds: number;
};

const MAX_MESSAGES = 80;

function isVisionexDefinitionQuestion(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  return (
    /\b(what is|what's|tell me about|describe|define|what does)\s+visionex\b/.test(normalized) ||
    /ما\s*(هو|هي)\s*(منصة\s*)?visionex|ما\s*(هو|هي)\s*(منصة\s*)?فيجن\s*اكس|عرّفني\s*(على|عن)\s*(visionex|فيجن\s*اكس)|ماذا\s*تقدم\s*(visionex|فيجن\s*اكس)/i.test(input)
  );
}

function visionexOverview(language: string): string {
  if (language === "ar") {
    return `**Visionex منصة عالمية تخدم الجميع**، وتجمع في مكان واحد التجارة والتعلّم والخدمات والذكاء الاصطناعي والترفيه والمجتمع، مع اهتمام أصيل بإمكانية الوصول دون أن تكون المنصة محصورة بفئة واحدة.

- **التجارة وVXBazaar:** شراء المنتجات العامة والتقنيات المساعدة، اكتشاف الخدمات، فتح متجر، أو تحويل متجر قائم إلى واجهة رقمية غنية وسهلة الوصول.
- **الأكاديمية والتعلّم:** دورات ومقالات ومساعدة دراسية وتدريب مهني ومسارات لتطوير المهارات.
- **المحاكاة والمشاريع:** تجارب عملية في الأعمال والمهن تساعد المستخدم على التعلّم واتخاذ القرارات والتخطيط لمشروع مستقل حقيقي.
- **الخدمات المتخصصة:** الإرشاد الدراسي والمهني، التغذية، الدعم النفسي والعاطفي، المعلومات الطبية العامة الآمنة، الإرشاد القانوني والتقني، التسويق، تصميم المواقع، الاستيراد والشراء، السفر، الرياضة، الموسيقى والإنتاج الإبداعي، والعناية بالشعر والبشرة وغيرها.
- **أدوات الذكاء الاصطناعي:** مساعد Visionex العام، مساعدين متخصصين، تحليل الصور والوجبات، OCR لقراءة النصوص، Radar AI لوصف المشاهد، وأدوات للتخطيط والتنقل داخل المنصة.
- **المجتمع والتواصل:** الرسائل والصداقات والمحادثات الصوتية وغرف الصوت والنقاشات والتعاون والتعارف.
- **الترفيه والإعلام:** ألعاب، راديو وتلفزيون مباشر، أخبار وتجارب تفاعلية.
- **إمكانية الوصول:** دعم قارئات الشاشة ولوحة المفاتيح والصوت واللغات المتعددة، وإرشاد للتقنيات المساعدة، لتكون التجربة مفيدة للمكفوفين وضعاف البصر وذوي الإعاقة وغير ذوي الإعاقة.
- **اقتصاد VX:** عملات VX والمكافآت والإعلانات المدفوعة بالمكافآت والإنجازات وفتح مزايا المنصة.

باختصار، Visionex مساحة عالمية تساعدك على أن تتعلّم وتعمل وتبيع وتشتري وتبني مشروعًا وتحصل على دعم وتتواصل وتستمتع. أخبرني ما هدفك، وسأرشدك مباشرةً إلى القسم الأنسب.`;
  }

  return `**Visionex is a global platform that serves everyone**, bringing commerce, learning, services, AI, entertainment, and community together in one place, with accessibility as a core strength rather than a limitation on who the platform is for.

- **Commerce and VXBazaar:** buy general and assistive products, discover services, open a shop, or turn an existing business into a rich accessible digital storefront.
- **Academy and learning:** courses, articles, study help, professional training, and skill-building paths.
- **Simulations and projects:** practical business and professional experiences that help users learn, test decisions, and plan real independent projects.
- **Specialized services:** career and study guidance, nutrition, psychology and emotional support, safe general medical information, legal and technical guidance, marketing, web design, importing and purchasing, travel, sports, music, creative production, hair care, skin care, and more.
- **AI tools:** the Visionex companion, specialist assistants, image and meal analysis, OCR, Radar AI scene understanding, planning tools, and platform navigation help.
- **Community and communication:** messages, friendships, voice chat, voice rooms, live discussions, collaboration, and social discovery.
- **Entertainment and media:** games, live radio, live television, news, and interactive experiences.
- **Accessibility:** screen-reader, keyboard, voice, multilingual, and assistive-technology support for blind, low-vision, disabled, and non-disabled users alike.
- **VX economy:** VX Coins, rewards, rewarded advertisements, achievements, and unlockable platform features.

In short, Visionex helps people learn, work, sell, buy, build projects, get support, connect, and enjoy digital experiences. Tell me your goal and I’ll guide you to the best place to begin.`;
}

function appendMessage(prev: Message[], msg: Message): Message[] {
  const next = [...prev, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

export function useAIChat(options?: { assistantId?: string }) {
  const assistantId = options?.assistantId;
  const [messages, setMessages]     = useState<Message[]>([]);
  const [memory, setMemory] = useState<CompanionMemory>(() => loadCompanionMemory());
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    isRateLimited: false,
    cooldownSeconds: 0,
  });
  const abortRef          = useRef<AbortController | null>(null);
  const cooldownTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const { lang }          = useLanguage();
  const { pathname }      = useLocation();
  const navigate          = useNavigate();

  const { consumeStream, isStreaming } = useSSEStream();

  const startCooldown = useCallback(() => {
    const COOLDOWN = 30;
    setRateLimitInfo({ isRateLimited: true, cooldownSeconds: COOLDOWN });
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    let remaining = COOLDOWN;
    cooldownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
        setRateLimitInfo({ isRateLimited: false, cooldownSeconds: 0 });
      } else {
        setRateLimitInfo({ isRateLimited: true, cooldownSeconds: remaining });
      }
    }, 1000);
  }, []);

  const sendMessage = useCallback(
    async (
      input: string,
      productContext?: { productName?: string; currentStep?: string }
    ) => {
      const userMsg: Message = {
        id:      crypto.randomUUID(),
        role:    "user",
        content: input,
      };

      setMessages((prev) => appendMessage(prev, userMsg));

      if (!assistantId && isVisionexDefinitionQuestion(input)) {
        setMessages((prev) => appendMessage(prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: visionexOverview(lang),
        }));
        return;
      }

      const controller  = new AbortController();
      abortRef.current  = controller;
      const responseId = crypto.randomUUID();

      const apiMessages = [...messages, userMsg].map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      }));

      try {
        const pageContext = buildCompanionPageContext();
        const toolResult = runCompanionTool(input, pageContext);

        if (toolResult.handled) {
          if (toolResult.navigateTo) navigate(toolResult.navigateTo);
          setMessages((prev) => appendMessage(prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: toolResult.message || "تم.",
          }));
          setMemory(loadCompanionMemory());
          return;
        }

        const response = await aiService.streamChat(
          apiMessages,
          {
            currentPage: pathname,
            language:    lang,
            pageContext,
            companionMemoryEnabled: memory.enabled,
            companionMemory: memory.enabled ? memory.notes : [],
            companionCapabilities: [
              "navigate_sections",
              "summarize_current_page",
              "compare_known_products",
              "remember_user_preferences_when_explicitly_asked",
            ],
            ...(toolResult.context || {}),
            ...(assistantId ? { assistantId } : {}),
            ...(productContext || {}),
          },
          controller.signal
        );

        let completedReply = "";
        await consumeStream(response, {
          onToken: (_token, accumulated) => {
            completedReply = accumulated;
          },
          onError: (err, isRateLimit) => {
            if (isRateLimit) startCooldown();
            setMessages((prev) => appendMessage(prev, {
              id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${err.message}`,
            }));
          },
        });
        if (completedReply.trim()) {
          setMessages((prev) => appendMessage(prev, {
            id: responseId, role: "assistant", content: completedReply,
          }));
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setMessages((prev) => appendMessage(prev, {
          id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${msg}`,
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [messages, lang, pathname, consumeStream, assistantId, startCooldown, memory.enabled, memory.notes, navigate]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleMemory = useCallback(() => {
    setMemory((current) => setCompanionMemoryEnabled(!current.enabled));
  }, []);

  const clearMemory = useCallback(() => {
    const next = { enabled: memory.enabled, notes: [] };
    saveCompanionMemory(next);
    void clearServerCompanionMemory();
    setMemory(next);
  }, [memory.enabled]);

  return {
    messages,
    isLoading: isStreaming,
    rateLimitInfo,
    memory,
    toggleMemory,
    clearMemory,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}
