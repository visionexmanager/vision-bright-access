import { createClient } from "npm:@supabase/supabase-js@2";
import { boundedText, checkImageDataUrl } from "../_shared/providerInput.ts";
import { decodePdfDataUrl, isPdfDataUrl, PDF_NO_TEXT_CODE, PDF_NO_TEXT_MESSAGE, pdfScanResult } from "../_shared/ocrDocument.ts";
import { extractPdfText } from "../_shared/whatsappPdfText.ts";
import { detectLanguage } from "../_shared/whatsappLanguageDetect.ts";
import { ProviderError, structuredCompletionWithFallback, type ProviderTarget } from "../_shared/aiProvider.ts";
import { subscriptionGate } from "../_shared/subscriptionGate.ts";
import { installUsageMetering } from "../_shared/usageMeter.ts";

installUsageMetering("ocr-scan");

// OpenAI leads because it renders every page of a scanned PDF. When its credit or
// quota runs out (429 insufficient_quota) or it is down, the chain moves to Gemini
// instead of failing every scan, which is what a single provider did.
const OCR_TARGETS: ProviderTarget[] = [
  { provider: "openai", model: "gpt-4o" },
  { provider: "gemini", model: "gemini-flash-lite-latest" },
  { provider: "gemini", model: "gemini-flash-latest" },
];

const OCR_SCHEMA = {
  type: "object",
  properties: {
    extracted_text: { type: "string", description: "All text extracted from the image, preserving original layout" },
    detected_language: { type: "string", description: "Primary language detected (e.g. English, Arabic, Hindi)" },
    confidence: { type: "string", enum: ["High", "Medium", "Low"], description: "OCR confidence based on image quality" },
    word_count: { type: "number", description: "Approximate number of words extracted" },
    has_handwriting: { type: "boolean", description: "Whether handwritten text was detected" },
  },
  required: ["extracted_text", "detected_language", "confidence", "word_count", "has_handwriting"],
  additionalProperties: false,
} as const;

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

const SYSTEM_PROMPT_EN = `You are an advanced OCR (Optical Character Recognition) engine.
Your sole task is to extract ALL text from the provided image with maximum accuracy.

Rules:
1. Extract every visible character, word, number, symbol, and punctuation mark exactly as it appears.
2. Preserve the original layout as much as possible — use newlines to separate paragraphs and sections.
3. For tables, use tabs or spaces to align columns.
4. For handwritten text, transcribe your best reading and mark uncertain parts with [?].
5. Include text from all areas: headers, footers, watermarks, captions, labels.
6. Do NOT summarize, interpret, or add commentary — just extract the raw text.
7. Detect the primary language of the document. Any language and any script is possible (Arabic, Hebrew, Persian, Urdu, Hindi, Bengali, Chinese, Japanese, Korean, Cyrillic, Latin and others): transcribe it in its own script, keep right-to-left text in reading order, and never translate or transliterate.
8. Return a confidence level: High / Medium / Low based on image quality.`;

const SYSTEM_PROMPT_AR = `أنت محرك OCR متقدم (التعرف الضوئي على الحروف).
مهمتك الوحيدة هي استخراج جميع النصوص من الصورة المقدمة بأقصى دقة ممكنة.

القواعد:
1. استخرج كل حرف ورقم ورمز وعلامة ترقيم كما يظهر بالضبط.
2. حافظ على التخطيط الأصلي قدر الإمكان — استخدم أسطراً جديدة للفصل بين الفقرات والأقسام.
3. للجداول، استخدم المسافات لمحاذاة الأعمدة.
4. للخط اليدوي، انسخ أفضل قراءة وضع علامة [؟] على الأجزاء غير المؤكدة.
5. اشمل النص من جميع المناطق: الرؤوس والتذييلات والعلامات المائية والتسميات التوضيحية.
6. لا تلخص أو تفسر أو تضيف تعليقات — فقط استخرج النص الخام.
7. اكتشف اللغة الأساسية للوثيقة. قد تكون بأي لغة وأي خط: انسخ النص بخطه الأصلي ولا تترجمه ولا تحوّله إلى حروف أخرى.
8. أعد مستوى الثقة: مرتفع / متوسط / منخفض بناءً على جودة الصورة.`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Require a valid Supabase session ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limiting: 20 scans / user / day ──────────────────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Subscription gate: no AI work, limit, VX charge or provider call without an active paid plan.
    const refused = await subscriptionGate(serviceClient, req, user.id, corsHeaders);
    if (refused) return refused;

    const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", {
      _user_id: user.id,
      _function_name: "ocr-scan",
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Daily limit reached (20 scans/day). Try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image, lang = "en", hint: rawHint } = await req.json();
    const hint = boundedText(rawHint, 500);

    // A PDF's text is in the file: read it locally, with no provider call.
    // The page's "PDF Scan" package used to send it to the vision model, which
    // cannot read a PDF, so every PDF scan failed.
    //
    // A scan has no text layer. It goes to the same OCR call as a photograph,
    // as an OpenAI `file` part — OpenAI renders every page for the model — so
    // it is read rather than refused with "upload photos of its pages".
    let scannedPdf = false;
    if (isPdfDataUrl(image)) {
      const upload = decodePdfDataUrl(image);
      if (upload.outcome === "refused") {
        return new Response(
          JSON.stringify({ error: upload.error }),
          { status: upload.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const pdf = await extractPdfText(upload.bytes);
      if (!pdf.ok && pdf.reason !== "scanned") {
        console.error(`[ocr-scan] pdf: ${pdf.reason}`);
        return new Response(
          JSON.stringify({ error: PDF_NO_TEXT_MESSAGE, code: PDF_NO_TEXT_CODE }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (pdf.ok) {
        const result = pdfScanResult(pdf.text, detectLanguage(pdf.text)?.language ?? null);
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      scannedPdf = true;
    }

    // Inline images only, bounded — never a URL for the provider to fetch
    // (Phase 2F-3). A scanned PDF was bounded by decodePdfDataUrl above.
    if (!scannedPdf) {
      const checked = checkImageDataUrl(image);
      if (checked.outcome === "refused") {
        return new Response(
          JSON.stringify({ error: checked.error }),
          { status: checked.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    const systemPrompt = lang === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;
    const userText = hint
      ? (lang === "ar"
          ? `استخرج النص من هذه الصورة. تلميح إضافي: ${hint}`
          : `Extract all text from this image. Additional hint: ${hint}`)
      : (lang === "ar"
          ? "استخرج جميع النصوص من هذه الصورة بدقة تامة."
          : "Extract all text from this image with maximum accuracy.");

    let result: unknown;
    try {
      ({ result } = await structuredCompletionWithFallback({
        targets: OCR_TARGETS,
        system: systemPrompt,
        userText,
        ...(scannedPdf ? { pdf: image } : { image }),
        schema: OCR_SCHEMA as unknown as Record<string, unknown>,
        toolName: "ocr_result",
        maxTokens: 4000,
      }));
    } catch (e) {
      if (e instanceof ProviderError && e.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("ocr-scan providers:", e instanceof Error ? e.message : "failed");
      throw new Error("The text could not be read right now. Please try again shortly.");
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-scan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
