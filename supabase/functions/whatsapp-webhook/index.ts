// WhatsApp Cloud API webhook → the existing Visionex assistant.
//
// This is the only new surface the WhatsApp AI needs. It does not introduce an
// AI: it looks up "whatsapp-support" in the same assistant registry the site
// uses and streams it through the same provider layer and the same
// OPENAI_API_KEY. No new vendor, no second model configuration.
//
// It stays inert until the Meta credentials below exist, and it never trusts a
// request it cannot cryptographically attribute to Meta.
//
// Required Edge Function secrets (none are committed anywhere):
//   WHATSAPP_VERIFY_TOKEN   - any random string; also typed into the Meta console
//   WHATSAPP_APP_SECRET     - Meta app secret, used to verify X-Hub-Signature-256
//   WHATSAPP_TOKEN          - permanent access token for the sending number
//   WHATSAPP_PHONE_NUMBER_ID- the Cloud API phone number id

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAssistant } from "../_shared/assistants.ts";
import {
  createEmbedding,
  streamChatCompletionWithFallback,
  structuredCompletionWithFallback,
  ProviderError,
} from "../_shared/aiProvider.ts";
import {
  budgetTurns,
  clampReply,
  collectStream,
  detectLanguage,
  detectLanguageCode,
  languageDirective,
  LANGUAGE_ENDONYM,
  replyLanguage,
  extractMessages,
  type IncomingMessage,
  failureNotice,
  handoverNotice,
  isSupportedLanguage,
  rateLimitDecision,
  rateLimitNotice,
  RATE_LIMIT_COOLDOWN_MS,
  REPEAT_LIMIT,
  needsSummary,
  redactSummary,
  replySignalsHandover,
  SUMMARY_INSTRUCTION,
  summaryPreamble,
  sendWhatsAppText,
  unsupportedTypeNotice,
  userAskedForHuman,
  verifySignature,
} from "../_shared/whatsapp.ts";
import { downloadMedia, mediaFailureNotice } from "../_shared/whatsappMedia.ts";
import { transcribeVoice, transcriptionFailureNotice } from "../_shared/whatsappTranscribe.ts";
import {
  understandDocument,
  understandImage,
  understandVideo,
  VIDEO_READING_AVAILABLE,
} from "../_shared/whatsappUnderstand.ts";
import {
  emptyDocumentNotice,
  encryptedDocumentNotice,
  MAX_VIDEO_BYTES,
  noReaderNotice,
  scannedPdfNotice,
  unreadableNotice,
  unsupportedDocumentNotice,
  videoTooLongNotice,
} from "../_shared/whatsappAttachments.ts";
import {
  fetchNearby,
  fetchWeather,
  geocodePlace,
  reverseGeocode,
} from "../_shared/whatsappGeo.ts";
import {
  asksWhatIsNearby,
  asksWhereAmI,
  formatNearby,
  formatWhereYouAre,
  geocodeUnavailableNotice,
  isUsableCoordinate,
  LOCATION_TTL_MS,
  locationNeededNotice,
  nearbyHint,
  placeLabel,
  shortPlaceLabel,
} from "../_shared/whatsappLocation.ts";
import {
  formatWeather,
  parseWeatherRequest,
  placeNotFoundNotice,
  weatherNeedsPlaceNotice,
  weatherUnavailableNotice,
} from "../_shared/whatsappWeather.ts";
import {
  bazaarUnavailableNotice,
  browseNotice,
  formatListings,
  noListingsNotice,
  parseBazaarRequest,
  sellGuidance,
  type BazaarListing,
} from "../_shared/whatsappBazaar.ts";
import {
  hasPreferenceChange,
  parsePreferenceRequest,
  preferenceConfirmation,
  voiceModeExplainer,
  verbosityDirective,
} from "../_shared/whatsappPreferences.ts";
import {
  ACCOUNT_CODE_STEP,
  ACCOUNT_EMAIL_STEP,
  ACCOUNT_FEATURE,
  formatOrders,
  generateLinkCode,
  hashLinkCode,
  LINK_CODE_TTL_MINUTES,
  normaliseEmail,
  ORDER_PAGE,
  parseAccountIntent,
  readLinkCode,
  readOrders,
  sendLinkCodeEmail,
} from "../_shared/whatsappIdentity.ts";
import { deliverReply, replyMedium, speakReply } from "../_shared/whatsappVoiceReply.ts";
import { speechCacheStore } from "../_shared/whatsappSpeechCache.ts";
import {
  type Capability,
  type CatalogNode,
  childrenOf,
  isAvailable,
  type Language,
  localized,
  nodeById,
  parseDisabledFeatures,
  ROOT_ID,
} from "../_shared/whatsappCatalog.ts";
import {
  BACK_ID,
  deliverMenu,
  type Delivery,
  menuMessage,
  sendLanguageMenu,
  sendProfileChoice,
  sendQuestion,
  sendTappable,
} from "../_shared/whatsappInteractive.ts";
import {
  isOnboarding,
  type OnboardingPrompt,
  promptsForMedium,
  readOnboardingState,
  runOnboarding,
} from "../_shared/whatsappOnboarding.ts";
import {
  personalizationDirective,
  PROFILE_COLUMNS,
  readProfile,
  userContext,
} from "../_shared/whatsappProfile.ts";
import {
  LANGUAGE_ID_PREFIX,
  parseLanguagePage,
  parseLanguageSelection,
  type SupportedLanguage,
} from "../_shared/whatsappLanguages.ts";
import { boundSystemPrompt, describeError, MAX_SUMMARY_CHARS, boundText } from "../_shared/whatsappSafety.ts";
import {
  BRIEFING_TIMEOUT_MS,
  CLASSIFY_TIMEOUT_MS,
  claimDecision,
  isRepeatOf,
  isSendable,
  SUMMARY_TIMEOUT_MS,
  withDeadline,
} from "../_shared/whatsappReliability.ts";
import { createTelemetry, newCorrelationId, trace } from "../_shared/whatsappTelemetry.ts";
import { localCategory } from "../_shared/whatsappClassifier.ts";
import { inspectImage } from "../_shared/whatsappFileSafety.ts";
import {
  cached as geoCached,
  geocodeKey,
  type GeoCacheStore,
  nearbyKey,
  reverseKey,
  weatherKey,
} from "../_shared/whatsappGeoCache.ts";
import { say } from "../_shared/whatsappStrings.ts";
import {
  comingSoonNotice,
  type EngineMessage,
  featureErrorNotice,
  runEngine,
} from "../_shared/whatsappEngine.ts";
import { askAssistant } from "../_shared/whatsappAsk.ts";
import { noticeReasonFor, voiceToText } from "../_shared/whatsappVoiceTurn.ts";
import { chainProvider } from "../_shared/whatsappAskProvider.ts";
import {
  AI_CONVERSATION,
  AI_MENU,
  AI_NEW_CONVERSATION,
  AI_PROCESSING,
  AI_TEXT_INPUT,
  AI_VOICE_INPUT,
  assistantLimits,
  assistantOwnsInput,
  assistantSays,
  checkQuestion,
  shouldAnnounceWork,
  splitAnswer,
} from "../_shared/whatsappAssistant.ts";
import {
  currentNodeId,
  readSession,
  sessionColumns,
  sessionTimeoutMs,
} from "../_shared/whatsappSession.ts";
import {
  asksForMenu,
  awaitingImageNotice,
  parseVisionMode,
  translateTextPrompt,
  visionSystemPrompt,
  VISION_MODE_TTL_MS,
  type VisionMode,
} from "../_shared/whatsappVisionModes.ts";
import { readTextLocally } from "../_shared/whatsappLocalOcr.ts";
import {
  barcodeGroundTruth,
  productCodes,
  qrCodeNotice,
  scanBarcodes,
  textPayloads,
} from "../_shared/whatsappBarcode.ts";
import { corruptOfficeNotice, emptyOfficeNotice, officeKind } from "../_shared/whatsappOffice.ts";
import {
  CLASSIFY_INSTRUCTION,
  CLASSIFY_SCHEMA,
  fallbackBriefing,
  HANDOFF_INSTRUCTION,
  isCategory,
  quickCategory,
  shouldEscalate,
  type Category,
  type EscalationReason,
} from "../_shared/whatsappTriage.ts";
import {
  availableFeatures,
  catalogDirective,
  HANDLER_AUTHORITY_DIRECTIVE,
  knowledgeDirective,
  type MatchRow,
  retrieveKnowledge,
} from "../_shared/whatsappKnowledge.ts";
import {
  formatAmbiguityPrompt,
  formatPendingList,
  isOwner,
  parseOwnerCommand,
  type PendingApproval,
} from "../_shared/ownerControl.ts";

/** How much prior conversation the model sees. Enough for context, bounded. */
const HISTORY_LIMIT = 12;

/** Classification is a routing label, so it runs on the smallest model. */
const CLASSIFY_TARGETS = [
  { provider: "groq" as const, model: "llama-3.1-8b-instant" },
  { provider: "openai" as const, model: "gpt-4o-mini" },
];

/**
 * Summaries are bulk text work with no user waiting on the wording, so they go
 * to the cheapest capable provider rather than the one answering the customer.
 */
const SUMMARY_TARGETS = [
  { provider: "groq" as const, model: "llama-3.3-70b-versatile" },
  { provider: "openai" as const, model: "gpt-4o-mini" },
];

/** Owner commands are cheap but not free; this bounds a compromised handset. */
const OWNER_COMMAND_LIMIT_PER_HOUR = 120;

/** Read the configured owner number. Never hard-coded, never in the client. */
async function ownerPhone(db: ReturnType<typeof service>): Promise<string | null> {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "owner_contact")
    .maybeSingle();
  const value = (data?.value ?? {}) as { whatsapp_number?: string | null };
  return value.whatsapp_number ?? null;
}

/** The flag list, and whether it is actually known. */
interface FeatureConfig {
  disabled: string[];
  /**
   * False when the settings row could not be read at all.
   *
   * The distinction is the whole point. A row that says nothing is switched off
   * and a query that failed look identical if both produce an empty list, and
   * they mean opposite things: the first is a verified "everything is on", the
   * second is "I do not know". Carrying the difference is what lets the engine
   * fail closed on the second without punishing the first.
   */
  verified: boolean;
}

/**
 * Features switched off in production, read from the table Visionex already
 * keeps its configuration in.
 *
 *   key:   whatsapp_features
 *   value: { "disabled": ["news", "services.bazaar"] }
 *
 * Read once per delivery, next to the owner's number, and never cached across
 * deliveries: the point of a flag is that it takes effect on the next message.
 *
 * ── A missing row and a failed read are not the same thing ──────────────────
 *
 * A missing row is a real answer — nothing is switched off — and is verified.
 * A failed read is not an answer at all, and used to be treated as one: the
 * catch returned an empty list, and an empty list means "everything is on". So
 * the one moment a flag most needs to hold — a provider melting down at three
 * in the morning, which is also when a database is least likely to answer — was
 * the exact moment every flag silently lifted.
 *
 * Now a failed read is reported as unverified, and the engine refuses every
 * feature until it can be established. Navigation, help, the way back and the
 * assistant's own refusals all keep working, so nobody is stranded; what stops
 * is executing a feature nobody can currently vouch for.
 */
async function readFeatureConfig(db: ReturnType<typeof service>): Promise<FeatureConfig> {
  const { data, error } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "whatsapp_features")
    .maybeSingle();
  if (error) {
    // A normalised code, never the driver's message: a PostgREST error quotes
    // the failing statement, and this repository is public.
    console.error("[whatsapp] could not read feature flags:", describeError(error));
    return { disabled: [], verified: false };
  }
  return { disabled: parseDisabledFeatures(data?.value), verified: true };
}

/**
 * Handle a message from the configured owner.
 *
 * Reached only after the sender has been positively identified as the owner.
 * Returns the reply to send back, or null when the message was not a command
 * and should fall through to ordinary handling.
 */
async function handleOwnerCommand(
  db: ReturnType<typeof service>,
  from: string,
  text: string,
): Promise<string | null> {
  const command = parseOwnerCommand(text);
  if (command.kind === "unknown" && !command.reference) return null;

  // Rate limit: an owner handset that has been taken over should not be able
  // to churn through every pending decision unchecked.
  const { count } = await db
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "owner_command")
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= OWNER_COMMAND_LIMIT_PER_HOUR) {
    console.error("[whatsapp] owner command rate limit reached");
    return "Too many commands in the last hour. Try again shortly.";
  }

  await db.from("audit_logs").insert({
    action: `owner_command_${command.kind}`,
    entity_type: "owner_command",
    entity_id: null,
    metadata: { kind: command.kind, reference: command.reference, choice: command.choice },
  });

  // Content proposals are decided in the Owner Control Centre, where the
  // proposal and its approval move together. Excluding them here is what keeps
  // that true over this channel: a reference the listing never surfaced cannot
  // be found below, so the existing "no pending decision" reply answers it and
  // the engine is never reached. No branch, and nothing else changes.
  const { data: pendingRows } = await db
    .from("owner_approvals")
    .select("reference, action_type, title, summary, escalation_id")
    .eq("state", "WAITING_FOR_APPROVAL")
    .neq("action_type", "content_publish")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  const pending = (pendingRows ?? []) as Array<PendingApproval & { escalation_id: string | null }>;

  if (command.kind === "list_pending") return formatPendingList(pending);

  // A bare number carries no reference. It is only safe when exactly one
  // decision is outstanding; otherwise we ask rather than guess, because
  // guessing would apply a decision to the wrong customer's case.
  const target = command.reference
    ? pending.find((item) => item.reference === command.reference) ?? null
    : pending.length === 1
      ? pending[0]
      : null;

  if (!target && command.reference) {
    return `No pending decision with reference ${command.reference}. It may have been answered already or expired.`;
  }
  if (!target && pending.length > 1) return formatAmbiguityPrompt(pending);
  if (!target) return "Nothing is waiting for a decision right now.";

  if (command.kind === "approve" || command.kind === "reject") {
    const { data, error } = await db.rpc("decide_owner_approval", {
      _reference: target.reference,
      _approve: command.kind === "approve",
      _via: "whatsapp",
      _identifier: from,
      _note: command.note,
    });
    if (error) {
      console.error("[whatsapp] decide_owner_approval failed:", describeError(error));
      return "That decision could not be recorded. Please try again.";
    }
    const result = data as { ok?: boolean; error?: string };
    if (!result?.ok) {
      // Single-use by construction: a redelivered reply lands here.
      return `Reference ${target.reference} is no longer awaiting a decision.`;
    }

    if (target.escalation_id) {
      await db
        .from("support_escalations")
        .update({ state: command.kind === "approve" ? "OWNER_APPROVED" : "OWNER_REJECTED" })
        .eq("id", target.escalation_id);
    }
    return `${command.kind === "approve" ? "Approved" : "Rejected"} — ${target.reference}.`;
  }

  if (command.kind === "take_over" || command.kind === "return_to_ai") {
    const toHuman = command.kind === "take_over";
    if (target.escalation_id) {
      const { data: escalation } = await db
        .from("support_escalations")
        .select("customer_ref, channel")
        .eq("id", target.escalation_id)
        .maybeSingle();

      if (escalation?.channel === "whatsapp" && escalation.customer_ref) {
        await db
          .from("whatsapp_conversations")
          .update({
            control: toHuman ? "human" : "ai",
            control_changed_at: new Date().toISOString(),
            control_changed_by: "owner",
          })
          .eq("wa_phone", escalation.customer_ref);
      }

      await db
        .from("support_escalations")
        .update({ state: toHuman ? "OWNER_RESPONDED" : "RETURNED_TO_AI" })
        .eq("id", target.escalation_id);
    }

    await db.from("ai_feedback_events").insert({
      event_type: toHuman ? "owner_correction" : "action_succeeded",
      channel: "whatsapp",
      subject_type: "escalation",
      subject_id: target.escalation_id,
      summary: toHuman ? "Owner took over the conversation" : "Owner returned the conversation to the AI",
      detail: { reference: target.reference },
    });

    return toHuman
      ? `You now own this conversation (${target.reference}). The assistant will stay quiet until you return it.`
      : `Returned to the assistant (${target.reference}).`;
  }

  if (command.kind === "more_info") {
    return [
      `*${target.title}*  [${target.reference}]`,
      target.summary ?? "No further detail was recorded.",
    ].join("\n\n");
  }

  return null;
}

/**
 * The engine's view of a message kind.
 *
 * A sticker is an image with feelings; everything else maps across unchanged.
 * The engine never sees a Meta payload — this is the only place the two
 * vocabularies meet.
 */
function engineMessageKind(incoming: IncomingMessage): EngineMessage["kind"] {
  if (incoming.selection) return "interactive";
  if (incoming.location) return "location";
  if (incoming.media) return incoming.media.kind === "sticker" ? "image" : incoming.media.kind;
  if (incoming.text) return "text";
  return "unknown";
}

/**
 * What this deployment can actually do, read from the environment once.
 *
 * A feature declares what it needs; this says what is there. The two meet in
 * the engine, so a missing key becomes "that isn't available right now" in the
 * sender's language instead of a feature that accepts a tap and fails later.
 * Location and the bazaar need no key at all — one is a keyless map service,
 * the other is this project's own database.
 */
function availableCapabilities(): Capability[] {
  const has = (name: string) => !!Deno.env.get(name);
  const available: Capability[] = ["location", "bazaar"];
  if (has("OPENAI_API_KEY") || has("GROQ_API_KEY")) {
    available.push("ai", "speech_to_text");
  }
  if (has("OPENAI_API_KEY")) available.push("vision", "text_to_speech");
  return available;
}

/**
 * How much text a message carried, without carrying any of it.
 *
 * A length separates an empty transcription from a real one, a one-word reply
 * from a paragraph, and tells a reader of the log nothing whatsoever about what
 * was said. This repository is public.
 */
function questionTextLength(incoming: IncomingMessage): number {
  return (incoming.text ?? "").length;
}

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Meta's verification handshake ──────────────────────────────────────
  // Called once when the webhook URL is saved in the Meta console.
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (verifyToken && mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Read the raw body: Meta signs the exact bytes it sent, so re-serialising
  // the parsed object would produce a signature that never matches.
  const rawBody = await req.text();

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not configured — refusing the delivery.");
    return new Response("Not configured", { status: 503 });
  }

  const signed = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
  if (!signed) {
    console.error("[whatsapp] signature verification failed.");
    return new Response("Forbidden", { status: 403 });
  }

  // Meta retries anything that is not a prompt 200, so acknowledge first and
  // let a processing failure surface in the logs rather than as a retry storm.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) {
    // Status callbacks (delivered/read) land here and are not errors.
    return new Response("OK", { status: 200 });
  }

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    console.error("[whatsapp] sending credentials missing — message logged, no reply sent.");
  }

  const db = service();
  /**
   * Where a voice note that has already been synthesised is remembered.
   *
   * Built from the client that is already here rather than opening a second
   * connection, and handed to `speakReply` rather than reached for by it — so
   * the whole policy stays testable without a Postgres. Every failure inside it
   * is a cache miss, which is the behaviour that existed before it.
   */
  const speechCache = speechCacheStore(db);
  const [configuredOwner, featureConfig] = await Promise.all([ownerPhone(db), readFeatureConfig(db)]);
  const disabled = featureConfig.disabled;
  /**
   * Whether a feature may be executed at all this delivery.
   *
   * False only when the flag list could not be read. Every gate — the router,
   * the engine, and the word-driven capability parsers below — asks this same
   * value, so there is no door into a feature that skips it.
   */
  const configVerified = featureConfig.verified;
  if (!configVerified) {
    console.error("[whatsapp] feature configuration unverified — features fail closed for this delivery");
  }

  for (const incoming of messages) {
    /**
     * One id for this delivery, and for everything it causes.
     *
     * Generated per message rather than per request: a Meta payload can carry
     * several, and two messages sharing one id would be exactly the confusion
     * this exists to remove. Random and derived from nothing about the sender,
     * so it ties log lines to each other and to nobody.
     */
    const correlationId = newCorrelationId();

    /**
     * The message id this delivery has taken responsibility for, if any.
     *
     * Null until the claim succeeds, and null for a redelivery that decided to
     * skip — so the `finally` below can tell "we finished this" from "we never
     * started it", which are the two states that must not be confused.
     */
    let claimedMessageId: string | null = null;
    /** Set by the catch, so a failed delivery is never marked finished. */
    let handlingFailed = false;

    try {
      // Detection reruns on a transcript below, once there is one to read.
      let detected = detectLanguageCode(incoming.text);
      // The canned notices exist in Arabic and English; the model answers in the
      // sender's own language regardless.
      let language = detectLanguage(incoming.text);

      // ── Owner control centre ──────────────────────────────────────────
      //
      // Authorization is by configured number, checked before anything else.
      // A message from any other number is a customer message and is never
      // interpreted as a command, whatever it says.
      if (incoming.text && isOwner(incoming.from, configuredOwner)) {
        const reply = await handleOwnerCommand(db, incoming.from, incoming.text);
        if (reply) {
          if (token && phoneNumberId) {
            await sendWhatsAppText({ phoneNumberId, token, to: incoming.from, body: reply });
          }
          continue;
        }
        // Not a command — fall through and treat it as an ordinary message.
      }

      // ── Conversation record ───────────────────────────────────────────
      /**
       * The conversation row, read tolerantly.
       *
       * `deploy.yml` runs `Run DB migrations` and `Deploy → Supabase Edge
       * Functions` in parallel — both only `needs: gate` — so for a few minutes
       * on release day this function can be live against a schema that does not
       * yet have the columns it asks for. PostgREST answers the whole select
       * with an error in that case, `existing` comes back null, and every
       * conversation looks brand new: a second welcome, an insert that collides
       * with the unique phone number, and a customer who gets nothing back.
       *
       * So a failed read falls back to the columns that predate this release.
       * Everything the new ones drive has a safe default — no session, mirror
       * voice, no thread filter — and the assistant keeps answering until the
       * migration lands. The fallback costs one extra round trip on a path that
       * should never be taken twice in the lifetime of a deploy.
       */
      const SESSION_COLUMNS =
        "id, language, voice_mode, menu_sent_at, ai_thread_id, ai_thread_started_at, nav_path, current_feature, current_step, pending_operation, session_context, session_updated_at, " +
        PROFILE_COLUMNS + ", ";
      const ESTABLISHED_COLUMNS =
        "escalated, control, blocked_until, rate_notified_at, rate_limit_hits, preferred_language, summary, summarized_message_count, voice_replies, verbosity, pending_vision_mode, pending_vision_target, pending_vision_at, last_latitude, last_longitude, last_place, last_location_at";

      const firstRead = await db
        .from("whatsapp_conversations")
        .select(SESSION_COLUMNS + ESTABLISHED_COLUMNS)
        .eq("wa_phone", incoming.from)
        .maybeSingle();
      let existing = firstRead.data;

      /**
       * Whether the profile columns could be read at all.
       *
       * False during the few minutes on release day when this function is live
       * against a schema the migration has not reached yet. Onboarding is
       * skipped entirely in that window: writing to a column that does not
       * exist would throw, and the alternative — asking a customer their date
       * of birth and then losing the answer — is worse than not asking. The
       * assistant keeps answering exactly as it did before this release, and
       * the first message after the migration lands starts the flow properly.
       */
      const profileReadable = !firstRead.error;

      if (firstRead.error) {
        console.error("[whatsapp] reading the session columns failed:", firstRead.error.code ?? "unknown");
        ({ data: existing } = await db
          .from("whatsapp_conversations")
          .select("id, " + ESTABLISHED_COLUMNS)
          .eq("wa_phone", incoming.from)
          .maybeSingle());
      }

      // A message with no text of its own — a voice note, a photo, a pin —
      // says nothing about which language its sender speaks, and detection on
      // an empty string returns the English default. That default was then
      // written straight back over the conversation's own language and used
      // for every notice below it, which is why an Arabic sender whose voice
      // note could not be read was apologised to in English. What this
      // conversation last actually spoke is the more honest answer.
      const remembered = existing?.language as string | null | undefined;
      if (!incoming.text.trim() && isSupportedLanguage(remembered)) {
        detected = remembered;
        language = remembered === "ar" ? "ar" : "en";
      }

      let conversationId = existing?.id as string | undefined;
      const isNew = !conversationId;

      if (!conversationId) {
        const { data: created, error } = await db
          .from("whatsapp_conversations")
          .insert({ wa_phone: incoming.from, language: detected })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = created.id as string;
      } else {
        await db
          .from("whatsapp_conversations")
          .update({ language: detected, last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      /**
       * Structured logs, safe to read in a public CI log.
       *
       * The rule is no longer a habit, it is a function. `createTelemetry`
       * drops every field whose name is not on `TELEMETRY_FIELDS` and every
       * value that is not a count, a duration or an ASCII label — so a phone
       * number, a message body, a retrieved passage or a provider's response
       * body cannot be published by somebody adding a field to a log call.
       * This repository is public and its CI logs are world-readable, which
       * makes a log line a publication rather than a debugging convenience.
       *
       * `correlation` is the thread tying one delivery's lines together —
       * routing, transcription, retrieval, the provider call, the send — and
       * it is random rather than derived from the sender, so it joins log
       * lines up without joining a person up.
       *
       * Meta's own message id is deliberately not here. It decodes to the
       * sender's phone number, and `correlation` already does what it was
       * being used for. It remains in the database, on `wa_message_id`,
       * where deduplication needs the real value and where nothing public can
       * read it.
       *
       * Nothing here can throw. A delivery that answered the customer and
       * then died writing a log line would be redelivered by Meta and the
       * customer answered twice.
       */
      const startedAt = Date.now();
      const log = createTelemetry(
        {
          correlation: correlationId,
          conversation: conversationId,
          kind: engineMessageKind(incoming),
        },
        { startedAt },
      );
      log("received", { chars: questionTextLength(incoming), selection: !!incoming.selection });

      /**
       * Where map answers are remembered.
       *
       * Every geo service here is keyless and free, so this saves no credits.
       * What it protects is the usage policy — Nominatim asks for at most one
       * request per second and Overpass is a volunteer cluster, and this
       * channel called both once per message with no cache and no throttle.
       *
       * Both halves swallow their own failures and return the safe answer. A
       * cache that can break a lookup is worse than no cache, and `geoCached`
       * treats an unreachable store as a miss.
       */
      const geoStore: GeoCacheStore = {
        read: async (key) => {
          const { data } = await db
            .from("whatsapp_geo_cache")
            .select("value")
            .eq("cache_key", key)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();
          return data?.value ?? null;
        },
        write: async (key, value, ttlMs) => {
          await db.from("whatsapp_geo_cache").upsert({
            cache_key: key,
            value,
            expires_at: new Date(Date.now() + ttlMs).toISOString(),
          }, { onConflict: "cache_key" });
        },
      };

      /** One lookup, cached, with the outcome logged as a label and nothing else. */
      const viaCache = async <T>(
        key: string,
        kind: Parameters<typeof geoCached>[1],
        fetcher: () => Promise<T | null>,
      ): Promise<T | null> => {
        const result = await geoCached<T>(key, kind, geoStore, fetcher);
        // A kind and an outcome. Never the coordinate, which is the whole
        // reason the key is rounded in the first place.
        log("geo_lookup", { reason: kind, outcome: result.outcome });
        return result.value;
      };

      // What the transcript records for a message with no text of its own.
      //
      // A pin is logged as `[location]` and nothing more: the coordinates live
      // in their own columns, which are cleared on their own short clock, and
      // copying them into a transcript kept for ninety days would quietly undo
      // that. The kind is also named where it was not before — an attachment
      // with no caption used to be filed as the literal string
      // `[undefined]`, which tells whoever reads the transcript nothing.
      const transcriptBody = incoming.text
        || (incoming.location ? "[location]" : "")
        || `[${incoming.unsupportedType ?? incoming.media?.kind ?? "empty"}]`;

      // ── Claiming this message, before anything expensive happens ─────────
      //
      // Meta redelivers on any non-200, so the same message id can arrive
      // twice. The unique index on wa_message_id makes the retry a no-op
      // instead of a second transcription, a second model call and a duplicate
      // reply — and the claim is taken here, above the rate limiter and far
      // above any provider, so nothing is ever paid for twice.
      //
      // What is new is that the claim records whether the work *finished*. It
      // did not before, and a delivery that died halfway therefore left the row
      // inserted and the customer unanswered: Meta redelivered, the insert
      // collided, and the retry was discarded as a duplicate. The mechanism
      // that made retries safe was also the one that made recovery impossible,
      // and the result was silence — which for a blind sender is the worst
      // outcome this system has.
      const claimedAt = new Date().toISOString();
      const { error: dupe } = await db.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "inbound",
        wa_message_id: incoming.messageId,
        body: transcriptBody,
        processing_state: "processing",
        processing_started_at: claimedAt,
      });

      if (dupe) {
        if (dupe.code !== "23505") throw dupe;

        // Somebody already claimed this id. `claimDecision` is a pure function
        // of the row and the clock, so which of the three answers this is can be
        // driven directly by the suite.
        const { data: prior } = await db
          .from("whatsapp_messages")
          .select("processing_state, processing_started_at")
          .eq("wa_message_id", incoming.messageId)
          .maybeSingle();

        const claim = claimDecision(prior, Date.now());
        log("redelivery", {
          outcome: claim.action,
          reason: claim.action === "skip" ? claim.reason : "recovered",
        });
        if (claim.action === "skip") continue;

        // Retake it, so a third delivery arriving now sees work in flight
        // rather than a second abandoned claim to rescue.
        await db
          .from("whatsapp_messages")
          .update({ processing_state: "processing", processing_started_at: claimedAt })
          .eq("wa_message_id", incoming.messageId);
      }

      // From here the work is ours, and the `finally` at the bottom of the loop
      // is what marks it finished. Set after the claim rather than before, so a
      // message this delivery decided to skip is never marked done by it.
      claimedMessageId = incoming.messageId;

      /**
       * Whether the message being answered was itself spoken.
       *
       * The whole of the default behaviour: somebody who sends a voice note
       * has already said how they want to be answered, and somebody who typed
       * has said the opposite in the same breath.
       */
      const spokenInput = incoming.media?.kind === "audio";

      /**
       * Where this sender is, loaded from the row they already have.
       *
       * `readSession` is tolerant: a path naming a node this build no longer
       * has resolves to the main menu rather than throwing. Somebody mid-task
       * should never meet an error because the menu was reorganised under them.
       */
      let session = readSession(existing as Record<string, unknown> | null);

      /** Written once per message, whatever route it took. */
      const saveSession = async () => {
        await db
          .from("whatsapp_conversations")
          .update(sessionColumns(session, new Date().toISOString()))
          .eq("id", conversationId);
      };


      /**
       * The language the interface is written in for this message.
       *
       * Declared here rather than half way down because the menus, the
       * onboarding questions and the model all have to agree about it, and
       * three places resolving it separately is three places to disagree. A
       * stored preference always wins over detection: somebody who tapped
       * Français does not want to be switched back because they quoted an
       * English product name.
       */
      let answerLanguage = replyLanguage(detected, existing?.preferred_language as string | null);

      /**
       * Which of the two languages the older feature *formatters* are written in.
       *
       * The refusals no longer belong here: handover, the rate limit, the
       * provider failure, every media and attachment refusal and every Office
       * one moved into `whatsappStrings.ts` and take `answerLanguage`, in all
       * twenty. What is left on this narrow pair is the formatted content —
       * weather condition words and day names, the compass points and category
       * labels behind "what's near me", the bazaar listing block, the
       * vision-mode names and the voice explainer. Those are ~600 strings and
       * their own piece of work; until then a Turkish sender gets a Turkish
       * conversation and an English forecast card, which is visible and
       * survivable in a way an English *refusal* was not.
       */
      let noticeLanguage: "ar" | "en" = answerLanguage === "ar" ? "ar" : "en";

      /**
       * One reply, in one medium, sent exactly once.
       *
       * The medium is decided by `replyMedium` and by nothing here: a voice
       * note is answered out loud and only out loud, a typed message in writing
       * and only in writing, and the interface — menus, onboarding, refusals —
       * is always text. Nobody receives the same answer twice in two forms.
       *
       * The transcript records the words whichever way they travelled, so a
       * spoken answer is still readable by whoever triages the thread later,
       * and `medium` is the only record that it was *heard* rather than read.
       */
      /** The words that went out last, so the same ones cannot go out twice. */
      let lastSentBody: string | null = null;

      const reply = async (body: string, kind: string) => {
        // ── Two things that must never be sent ──────────────────────────────
        //
        // Nothing at all: WhatsApp rejects an empty message outright, so a
        // blank body is not a quiet no-op — it is a failed send, an error in
        // the log, and a customer who got no reply to a question the assistant
        // believed it had answered.
        //
        // The same thing twice: deduplication stops one *inbound* message being
        // answered twice, and this stops one delivery saying the same words
        // twice — two branches that both believed they owned the message, or a
        // split answer whose parts collapsed into one. Neither is common; both
        // read to somebody using a screen reader as the assistant stuttering.
        if (!isSendable(body)) {
          log("reply_suppressed", { replyKind: kind, reason: "empty" });
          return;
        }
        if (isRepeatOf(body, lastSentBody)) {
          log("reply_suppressed", { replyKind: kind, reason: "duplicate" });
          return;
        }
        lastSentBody = body;

        const medium = replyMedium({ spokenInput, body });
        const { data: written } = await db.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          body,
          kind,
          medium,
        }).select("id").maybeSingle();
        if (!token || !phoneNumberId) return;

        // The two ways of sending, handed to the policy rather than chosen
        // here. Production passes these; the suite passes counters, which is
        // what lets it assert the transport of a whole conversation without a
        // Meta account or a synthesis bill.
        const delivered = await deliverReply(
          { body, kind, spokenInput, failureNotice: say("failed", answerLanguage), trace: correlationId },
          {
            sendText: (text) => sendWhatsAppText({ phoneNumberId, token, to: incoming.from, body: text }),
            speak: (text) =>
              speakReply({ phoneNumberId, token, to: incoming.from, text, trace: correlationId, cache: speechCache }),
          },
        );

        // A synthesis that failed did not travel by voice, whatever was written
        // a moment ago. The row is corrected rather than left claiming a voice
        // note nobody received — that column is what "is the voice reply
        // broken?" is answered from.
        if (delivered.spokenFailed && written?.id) {
          await db.from("whatsapp_messages").update({ medium: "text" }).eq("id", written.id);
        }

        log("replied", {
          replyKind: kind,
          chars: body.length,
          medium: delivered.medium,
          sent: delivered.sent,
          spokenFailed: delivered.spokenFailed,
        });
      };

      /**
       * Where every tappable message goes, and how it reaches the transcript.
       *
       * One object, built once, handed to the shared builders in
       * `whatsappInteractive.ts`. Nothing below writes a Meta payload by hand:
       * the authentication, the retry policy and the never-log-the-body rule
       * live in the sender, and this webhook stays orchestration.
       *
       * The transcript records the *text* twin whichever version went out, so
       * whoever triages the thread later reads what was offered rather than a
       * blank where an interactive message used to be. Filed as canned text, so
       * a ten-row menu is never replayed to the model as a turn of the
       * conversation and never spends the history budget on something nobody
       * said.
       */
      const delivery: Delivery = {
        phoneNumberId,
        token,
        to: incoming.from,
        trace: correlationId,
        record: async (text: string) => {
          await db.from("whatsapp_messages").insert({
            conversation_id: conversationId,
            direction: "outbound",
            body: text,
            kind: "welcome",
          });
        },
      };

      /**
       * Offer a menu — any menu, named by its node id.
       *
       * Rows with names on them, and the same names as words when Meta refuses
       * the interactive version: it does that outright outside the 24-hour
       * service window, and for a row title one character too long. A menu that
       * exists only inside a modal is a menu half this audience cannot reach,
       * so the names always go out either way — and the router resolves a name
       * typed back against the menu in view, which is what makes the text copy
       * something a person can act on rather than something they can only read.
       */
      const sendMenu = async (
        nodeId: string,
        lang: Language,
        options: { note?: string } = {},
      ) => {
        // A leaf has no children to list. It is reachable here after a cancel,
        // which leaves the sender standing inside the feature they cancelled,
        // and the honest answer is the menu that feature sits in.
        const target = childrenOf(nodeId).length > 0
          ? nodeId
          : (nodeById(nodeId)?.parent ?? ROOT_ID);

        // A note has to travel as its own message or it is lost: an interactive
        // list's body is its own fixed text, so "that option has moved" goes
        // out first and the list follows. It obeys the medium rule like
        // everything else — spoken to somebody who spoke.
        if (options.note) await reply(options.note, "welcome");

        const message = menuMessage(target, lang, disabled);
        if (!message) return;

        // Recorded before it is sent, and recorded as words either way, so the
        // thread reads as a conversation for whoever triages it later.
        //
        // The medium comes from `replyMedium` and from nothing here. It used to
        // be decided inline — `spokenInput ? "voice" : "text"` — which was a
        // second delivery-medium policy that happened to agree with the real
        // one. Two policies that agree today are two policies that will
        // disagree the first time one of them learns something, and this one
        // would not have learned that a menu with nothing speakable in it goes
        // out as text.
        const { data: menuRow } = await db.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          body: message.text,
          kind: "welcome",
          medium: replyMedium({ spokenInput, body: message.text }),
        }).select("id").maybeSingle();
        await db
          .from("whatsapp_conversations")
          .update({ menu_sent_at: new Date().toISOString() })
          .eq("id", conversationId);
        if (!token || !phoneNumberId) return;

        // A voice sender hears the menu and is shown nothing. That works
        // because a name is a way to choose: the router resolves a row's title
        // against the menu in view, and the old numbers still resolve too.
        const shown = await deliverMenu(
          { message, spokenInput },
          {
            tap: (tappable) => sendTappable(delivery, tappable),
            speak: (text) =>
              speakReply({ phoneNumberId, token, to: incoming.from, text, trace: correlationId, cache: speechCache }),
          },
        );
        // A menu that could not be spoken went out as a tappable message
        // instead, so the row is corrected rather than left claiming a voice
        // note nobody heard — the same correction `reply` makes, for the same
        // reason: that column is what "is the voice reply broken?" is answered
        // from.
        if (shown.spokenFailed && menuRow?.id) {
          await db.from("whatsapp_messages").update({ medium: "text" }).eq("id", menuRow.id);
        }
        log("menu", { node: target, medium: shown.medium, sent: shown.sent, spokenFailed: shown.spokenFailed });
      };

      // ── Abuse control ─────────────────────────────────────────────────
      //
      // Placed after the message is logged, so a throttled sender is still
      // recorded in the transcript and the team can see what was sent. Only
      // the model call and the reply are withheld. The owner is exempt: their
      // commands have their own separate limit above.
      if (!isNew && !isOwner(incoming.from, configuredOwner)) {
        const nowMs = Date.now();
        const [{ count: hourCount }, { count: minuteCount }, { data: recent }] = await Promise.all([
          db.from("whatsapp_messages").select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .gte("created_at", new Date(nowMs - 3_600_000).toISOString()),
          db.from("whatsapp_messages").select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .gte("created_at", new Date(nowMs - 60_000).toISOString()),
          db.from("whatsapp_messages").select("body")
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .order("created_at", { ascending: false }).limit(REPEAT_LIMIT),
        ]);

        // Only *text* can repeat in the sense this limit means.
        //
        // The rule exists to stop a client stuck in a resend loop, and genuine
        // redelivery is already a no-op via the unique `wa_message_id`. But an
        // attachment with no caption is logged by its kind, so three photos in
        // a row are three identical bodies — and three photos in a row is the
        // most ordinary thing a blind sender does here. Counting those silenced
        // exactly the person this assistant is for, for fifteen minutes.
        const repeatCount = incoming.text
          ? (recent ?? []).filter((row) => row.body === transcriptBody).length
          : 0;

        const verdict = rateLimitDecision({
          now: nowMs,
          blockedUntil: existing?.blocked_until ? Date.parse(existing.blocked_until as string) : null,
          notifiedAt: existing?.rate_notified_at ? Date.parse(existing.rate_notified_at as string) : null,
          lastHourCount: hourCount ?? 0,
          lastMinuteCount: minuteCount ?? 0,
          repeatCount,
        });

        if (!verdict.allow) {
          console.error(
            `[whatsapp] throttled: reason=${verdict.reason} hour=${hourCount} minute=${minuteCount} repeat=${repeatCount}`,
          );
          await db
            .from("whatsapp_conversations")
            .update({
              blocked_until: new Date(nowMs + RATE_LIMIT_COOLDOWN_MS).toISOString(),
              rate_limit_hits: ((existing?.rate_limit_hits as number) ?? 0) + 1,
              ...(verdict.notify ? { rate_notified_at: new Date(nowMs).toISOString() } : {}),
            })
            .eq("id", conversationId);

          if (verdict.notify) await reply(rateLimitNotice(answerLanguage), "unsupported");
          continue;
        }
      }

      // ── First contact: which language, and who is this ────────────────
      //
      // A sender whose profile is not finished never reaches the navigation
      // engine. They are asked one thing at a time — the language first, in
      // English, because nothing yet knows what else to ask it in — and every
      // question is a message they can answer by tapping.
      //
      // Their phone number is not one of the questions. It arrived inside the
      // envelope Meta signed, it is what this row is keyed on, and asking
      // somebody to type the number they are texting from would let a typo
      // attach the profile to a different person.
      //
      // Established senders are not put through any of this: the migration
      // backfilled every row that already existed to `complete`, and a schema
      // this function is briefly ahead of resolves the same way.
      const onboardingState = profileReadable
        ? readOnboardingState(existing?.onboarding_status, !isNew)
        : "complete";

      /**
       * The language the onboarding questions are asked in.
       *
       * The stored choice, or English. Deliberately *not* detection: a language
       * is chosen by tapping a row, and reading it out of an Arabic-looking
       * greeting would pick Arabic for a Persian speaker who never asked for it.
       */
      const onboardingLanguage: SupportedLanguage =
        isSupportedLanguage(existing?.preferred_language as string | null)
          ? (existing?.preferred_language as SupportedLanguage)
          : "en";

      /** One prompt, performed. The builders are pure; this is the sending. */
      const offerPrompt = async (prompt: OnboardingPrompt, lang: SupportedLanguage) => {
        if (prompt.type === "text") {
          await reply(say(prompt.key, lang), "welcome");
        } else if (prompt.type === "question") {
          // A sentence with a way out under it. The numeric `0` never had one
          // that could be seen, which is most of why people got stuck in it.
          await sendQuestion(delivery, say(prompt.key, lang), lang, [
            { id: BACK_ID, title: say("back", lang) },
          ]);
        } else if (prompt.type === "language") {
          await sendLanguageMenu(delivery, prompt.page);
        } else if (prompt.type === "gender" || prompt.type === "country") {
          await sendProfileChoice(delivery, prompt.type, lang, incoming.from);
        } else {
          await sendMenu(ROOT_ID, lang);
        }
      };

      if (isOnboarding(onboardingState)) {
        const outcome = runOnboarding(
          { text: incoming.text, kind: engineMessageKind(incoming), selection: incoming.selection },
          {
            state: onboardingState,
            language: onboardingLanguage,
            phone: incoming.from,
            nowMs: Date.now(),
          },
        );

        // A state and a reason. Never the answer and never the field: this
        // repository is public and its CI logs are world-readable, so a log line
        // carrying somebody's date of birth carries it forever.
        log("onboarding", { state: outcome.state, reason: outcome.reason });

        if (Object.keys(outcome.columns).length > 0) {
          await db
            .from("whatsapp_conversations")
            .update({ ...outcome.columns, profile_updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        // What a voice note gets while onboarding is still running, and the one
        // documented exception to "somebody who spoke is shown nothing". The
        // rule itself is `promptsForMedium`, which the suite drives directly.
        const prompts = promptsForMedium(outcome.prompts, spokenInput, isNew);
        for (const prompt of prompts) await offerPrompt(prompt, outcome.language);
        continue;
      }

      // ── Changing the language afterwards ──────────────────────────────
      //
      // More → Language offers the same list, so the same ids have to mean the
      // same thing on this side of the gate as on the other. Handled here
      // rather than in the router because a language row is not a feature and
      // the catalog has no node for it — the router would rightly call it a row
      // this build no longer has.
      if (incoming.selection?.startsWith(LANGUAGE_ID_PREFIX)) {
        const page = parseLanguagePage(incoming.selection);
        if (page) {
          await sendLanguageMenu(delivery, page);
          continue;
        }
        const chosen = parseLanguageSelection(incoming.selection);
        if (chosen) {
          await db
            .from("whatsapp_conversations")
            .update({ preferred_language: chosen, language: chosen })
            .eq("id", conversationId);
          answerLanguage = chosen;
          noticeLanguage = chosen === "ar" ? "ar" : "en";
          log("language_changed");
          // Said, then shown. The menu redrawn in the new language is the proof
          // for anybody who can see it; the sentence — itself in the new
          // language — is the proof for everybody else.
          await reply(say("languageSet", chosen), "reply");
          await sendMenu(ROOT_ID, chosen);
          continue;
        }
      }

      // ── Preferences ───────────────────────────────────────────────────
      //
      // WhatsApp has no settings screen, so the only way to offer a preference
      // is to notice someone asking for it. Confirmed out loud, never silently.
      /**
       * Act on a preference the sender just asked for, if they asked for one.
       *
       * Reached twice: once for typed text, and again below for a transcript.
       * The second call is the one that matters. Asking out loud — "ردّ عليّ
       * صوتياً" — is how this audience sets a preference at all, and the parse
       * ran only on `incoming.text`, which for a voice note is the caption, and
       * a voice note has no caption. So the request to be answered by voice was
       * answered as an ordinary question, the setting never changed, and every
       * reply after it arrived as text: the feature looked dead from the one
       * direction it was built for.
       */
      const applyPreferences = async (text: string): Promise<boolean> => {
        const requested = parsePreferenceRequest(text);
        if (!hasPreferenceChange(requested)) return false;

        // Everything except the voice mode. Asking to "always reply with
        // voice" cannot be honoured any more and must not be recorded as
        // though it had been: the medium of an answer is the medium of the
        // question now, and a column saying otherwise would be a promise the
        // sender never gets. What they asked for is explained instead.
        const { voice_mode: spokenRequest, ...stored } = requested;
        if (Object.keys(stored).length > 0) {
          await db.from("whatsapp_conversations").update(stored).eq("id", conversationId);
        }

        const nextLanguage = stored.preferred_language ?? detected;
        if (Object.keys(stored).length > 0) {
          await reply(
            preferenceConfirmation(
              nextLanguage === "ar" ? "ar" : "en",
              stored,
              LANGUAGE_ENDONYM[nextLanguage],
            ),
            "reply",
          );
        }
        if (spokenRequest) await reply(voiceModeExplainer(noticeLanguage), "reply");
        return true;
      };

      // A caption is about the picture it arrived with, not an instruction
      // about how to answer, so an attachment's text is not read as one: "بدي
      // صوت" written under a photo is a question about that photo, and acting
      // on it here would swallow the photo entirely. A voice note's transcript
      // is read as one, further down, where the words actually exist.
      if (!incoming.media && incoming.text && await applyPreferences(incoming.text)) continue;

      // ── Attachments ───────────────────────────────────────────────────
      //
      // A voice note becomes text and is then answered like any other
      // question. Everything the assistant cannot yet read is acknowledged
      // rather than ignored, so the sender is never left wondering.
      let questionText = incoming.text;

      /**
       * Whether a person now owns this conversation.
       *
       * The triage section makes this same check, but far below — after every
       * capability added here. A forecast or a product list arriving in the
       * middle of a conversation with a human is exactly the two-voices
       * confusion that check exists to prevent, so the new paths honour it at
       * their own entry points. Anything that falls through still meets the
       * original check downstream, which is why they need no reply of their own.
       */
      const humanOwnsThis = existing?.control === "human" || existing?.escalated === true;

      // ── A shared pin ──────────────────────────────────────────────────
      //
      // Answered before the attachment block because a location carries no
      // media id — there is nothing to download — and answered at all because
      // the alternative, which is what shipped before this, was to tell
      // somebody who had just said precisely where they were standing that
      // their message could not be read.
      //
      // The coordinates are also kept, briefly, so the next question does not
      // need a second pin. See the six-hour ceiling in `whatsappLocation.ts`
      // and the erasure job in the migration.
      if (incoming.location) {
        // The pin is already in the transcript, where the person handling
        // the conversation can see it. A second voice answering it is not help.
        if (humanOwnsThis) continue;
        const { latitude, longitude } = incoming.location;
        if (!isUsableCoordinate(latitude, longitude)) {
          await reply(unsupportedTypeNotice(answerLanguage, "location"), "unsupported");
          continue;
        }

        const place = await viaCache(
          reverseKey(latitude, longitude, noticeLanguage),
          "reverse",
          () => reverseGeocode(latitude, longitude, noticeLanguage),
        );
        if (!place) {
          await reply(geocodeUnavailableNotice(noticeLanguage), "unsupported");
          continue;
        }

        const label = placeLabel(place, incoming.location.name ?? incoming.location.address);
        await db
          .from("whatsapp_conversations")
          .update({
            last_latitude: latitude,
            last_longitude: longitude,
            last_place: label || null,
            last_location_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        await reply(
          [
            formatWhereYouAre({
              language: noticeLanguage,
              place,
              pinName: incoming.location.name,
              pinAddress: incoming.location.address,
              latitude,
              longitude,
            }),
            "",
            nearbyHint(noticeLanguage),
          ].join("\n"),
          "reply",
        );

        // The weather follows as its own message rather than being appended.
        // It is a second topic, and a screen reader reads one message at a
        // time. A failure here costs the forecast, never the location answer
        // that has already been sent.
        const reading = await viaCache(
          weatherKey(latitude, longitude, Date.now()),
          "weather",
          () => fetchWeather(latitude, longitude),
        );
        if (reading) {
          await reply(
            formatWeather({
              language: noticeLanguage,
              placeName: shortPlaceLabel(place, incoming.location.name) || label,
              current: reading.current,
              daily: reading.daily,
              includeForecast: false,
            }),
            "reply",
          );
        }
        continue;
      }

      if (incoming.media) {
        if (!token) {
          await reply(unsupportedTypeNotice(answerLanguage, incoming.media.kind), "unsupported");
          continue;
        }

        if (incoming.media.kind === "audio") {
          /**
           * The whole chain, in one call, with its steps handed to it.
           *
           * Download and transcription are the same two functions this webhook
           * has always used — host-checked fetch, size ceiling enforced twice,
           * Groq then OpenAI. What `voiceToText` adds is a timeout and three
           * named outcomes, and what that buys is a suite that can drive a
           * corrupt file, a silent recording and a provider that never answers
           * without any of them touching the network.
           */
          const inAssistant = assistantOwnsInput(session.feature);
          if (inAssistant) {
            // Processing covers the *whole* chain, not just the model call:
            // downloading and transcribing are the slow half, and a sender
            // whose state says "waiting for your voice note" while the note is
            // already being transcribed is being told something untrue.
            session = { ...session, step: AI_PROCESSING };
            await saveSession();
          }

          /** Back where they were, whatever went wrong. Never left processing. */
          const recoverVoiceState = async () => {
            if (!inAssistant) return;
            session = { ...session, step: AI_VOICE_INPUT };
            await saveSession();
          };

          const turn = await voiceToText(incoming.media.id, {
            download: (mediaId) => downloadMedia({ mediaId, kind: "audio", token, trace: correlationId }),
            transcribe: (input) => transcribeVoice({ ...input, trace: correlationId }),
          });

          if (turn.status === "media_failed") {
            log("voice_media_failed", { reason: turn.reason, ms: turn.ms });
            await reply(mediaFailureNotice(answerLanguage, "audio", turn.reason), "unsupported");
            await recoverVoiceState();
            continue;
          }
          if (turn.status === "not_heard") {
            log("voice_not_heard", { reason: turn.reason, ms: turn.ms });
            await reply(
              transcriptionFailureNotice(answerLanguage, noticeReasonFor(turn.reason)),
              "unsupported",
            );
            // Still waiting for a voice note: somebody whose recording did not
            // come through should be able to simply record it again.
            await recoverVoiceState();
            continue;
          }

          log("voice_heard", { provider: turn.provider, ms: turn.ms, chars: turn.text.length });
          questionText = [incoming.media.caption, turn.text].filter(Boolean).join("\n");

          // Store what was heard, so the transcript and the replayed history
          // read as a conversation rather than as a gap — and mark the row as
          // having arrived by voice, which the body prefix could only imply.
          await db
            .from("whatsapp_messages")
            .update({ body: `[voice] ${turn.text}`, medium: "voice" })
            .eq("wa_message_id", incoming.messageId);

          /**
           * The language a voice note is answered in.
           *
           * A stored preference wins, then whatever this conversation has been
           * speaking, and only then the transcript. Whisper mishears a language
           * far more often than a person changes theirs mid-conversation, and
           * answering an Arabic customer in English because one sentence came
           * back as English is the worse failure by a distance. Saying «احكي
           * معي بالإنجليزي» still switches it — that is a preference, and
           * preferences are read from this same transcript a few lines below.
           */
          if (questionText.trim()) {
            const heardLanguage = detectLanguageCode(questionText);
            const spokenBefore = existing?.language as string | null | undefined;
            const settled = isSupportedLanguage(spokenBefore) ? spokenBefore : heardLanguage;
            answerLanguage = replyLanguage(settled, existing?.preferred_language as string | null);
            language = answerLanguage === "ar" ? "ar" : "en";
            noticeLanguage = language;
          }

          // A preference asked for out loud is set here, where the words
          // finally exist. Before this, only a typed request counted.
          if (await applyPreferences(questionText)) {
            await recoverVoiceState();
            continue;
          }
        } else if (incoming.media.kind === "image" || incoming.media.kind === "sticker") {

          const media = await downloadMedia({
            mediaId: incoming.media.id,
            kind: incoming.media.kind,
            token,
            trace: correlationId,
          });
          if (!media.ok) {
            await reply(mediaFailureNotice(answerLanguage, incoming.media.kind, media.reason), "unsupported");
            continue;
          }

          // ── Before a photograph leaves this server ────────────────────────
          //
          // Three things, in one call, in the order they have to happen.
          //
          // The MIME Meta reports comes from the sending client, so it is a
          // claim. `inspectImage` reads the bytes and refuses a file whose
          // real format is a different known format — a PDF sent as a JPEG is
          // not something a phone does by accident.
          //
          // The size ceiling in `MEDIA_LIMITS` bounds the download, not the
          // decode. A hundred-megapixel image compresses to a few megabytes of
          // flat colour and expands to hundreds of megabytes of pixels; the
          // dimensions are in the header, ahead of the pixels, so they are read
          // before anything is committed to.
          //
          // And then the metadata goes. A phone photograph carries EXIF, EXIF
          // carries GPS, and until now this function forwarded all of it to the
          // vision provider — for an audience that includes blind users
          // photographing their own medication and their own front door. The
          // picture is unchanged; only the part of it that was never the
          // picture is gone.
          const inspected = inspectImage(media.bytes, media.mimeType);
          if (!inspected.ok) {
            log("image_rejected", { reason: inspected.reason, chars: media.bytes.byteLength });
            await reply(unreadableNotice(answerLanguage, "image"), "unsupported");
            continue;
          }
          log("image_accepted", {
            // The slash is replaced because a telemetry label has to look like
            // a label: `sanitiseFields` drops `image/jpeg` and would have made
            // this field silently vanish from every log line.
            kind: inspected.sniffed.replace("/", "_"),
            // A count of bytes removed, never what they said.
            chars: inspected.removed,
            ok: inspected.stripped,
          });

          // ── Which of the five modes is this picture for? ──────────────
          //
          // The caption wins when there is one, because it is the most recent
          // thing the sender said. Otherwise a mode armed by an earlier message
          // — typically a voice note, which is the accessible way to set one —
          // applies, provided it has not gone stale. Neither present means the
          // general "what is this attachment" prompt, which is the behaviour
          // that existed before modes.
          const captionRequest = parseVisionMode(incoming.media.caption);
          const armedAt = existing?.pending_vision_at
            ? Date.parse(existing.pending_vision_at as string)
            : 0;
          const armedIsFresh = armedAt > 0 && Date.now() - armedAt < VISION_MODE_TTL_MS;
          const armedMode = armedIsFresh
            ? (existing?.pending_vision_mode as VisionMode | null) ?? null
            : null;

          const mode = captionRequest?.mode ?? armedMode;
          const modeTarget = captionRequest
            ? captionRequest.target
            : (existing?.pending_vision_target as string | null) ?? null;

          // Consumed whether or not it was used: a mode that survived its
          // picture would reinterpret the next, unrelated one.
          if (existing?.pending_vision_mode) {
            await db
              .from("whatsapp_conversations")
              .update({ pending_vision_mode: null, pending_vision_target: null, pending_vision_at: null })
              .eq("id", conversationId);
          }

          // ── Read it here first, when "here" can actually do the job ───
          //
          // Only for `read_text`. Tesseract reads words; it does not describe a
          // room, find an object in one, or read an expiry date off a curved
          // packet, and those are what the other four modes ask for. Sending
          // them here would trade a good answer for a cheap one.
          //
          // Every failure below falls through to exactly the code that ran
          // before this block existed, so the worst outcome is the current
          // outcome plus the local deadline. A blind user who asks a sign to be
          // read is the most common thing this assistant is asked to do, and it
          // is now the one thing that does not depend on a funded provider
          // account — but only when the local read is unambiguously good.
          if (mode === "read_text") {
            const local = await readTextLocally({
              // The stripped copy, the same bytes the model would have seen.
              bytes: inspected.bytes,
              mimeType: media.mimeType,
              answerLanguage,
            });
            log("local_ocr", {
              ok: local.ok,
              reason: local.ok ? "read" : local.reason,
              // A length and a duration. Never the words.
              chars: local.ok ? local.text.length : 0,
              ms: local.ok ? local.ms : 0,
            });
            if (local.ok) {
              await reply(clampReply(local.text), "reply");
              continue;
            }
          }

          // ── The barcode, which has no language ────────────────────────
          //
          // Only for `product`, the mode that already asks for "the product or
          // its barcode". zbar cannot describe a room or find a cane, so the
          // other modes would spend a scan to learn nothing.
          //
          // This does not replace the model, it precedes it. Nobody asked to
          // hear thirteen digits read aloud — they asked what they are holding,
          // and the model answers that. What the scan changes is that the model
          // is *told* the number instead of squinting at it, and a misread
          // digit on a box of medicine is not a cosmetic error.
          //
          // It is also the first local capability that serves this channel's
          // whole audience. Local OCR is English-only because Arabic
          // recognition does not work on this box; a barcode is digits, and
          // digits are the same in every language.
          let barcodeTruth: string | null = null;
          let barcodeText: string | null = null;
          if (mode === "product") {
            const scan = await scanBarcodes({
              bytes: inspected.bytes,
              mimeType: media.mimeType,
            });
            log("barcode", {
              ok: scan.ok,
              reason: scan.ok ? "decoded" : scan.reason,
              // Counts and a duration. Never the payload: a QR code routinely
              // carries somebody's booking reference.
              found: scan.ok ? scan.symbols.length : 0,
              ms: scan.ok ? scan.ms : 0,
            });
            if (scan.ok) {
              barcodeTruth = barcodeGroundTruth(productCodes(scan.symbols));
              // Never merged into the prompt. A sticker is attacker-controlled
              // text and this is the one path that keeps it out of one.
              barcodeText = qrCodeNotice(language, textPayloads(scan.symbols));
            }
          }

          const basePrompt = mode
            ? visionSystemPrompt(mode, LANGUAGE_ENDONYM[answerLanguage], modeTarget)
            : undefined;

          const seen = await understandImage({
            // The stripped copy. This is the line that makes the whole check
            // load-bearing rather than decorative.
            bytes: inspected.bytes,
            mimeType: media.mimeType,
            question: incoming.media.caption ?? "",
            languageName: LANGUAGE_ENDONYM[answerLanguage],
            systemPrompt: barcodeTruth ? `${basePrompt ?? ""} ${barcodeTruth}`.trim() : basePrompt,
          });
          // "I could not read it" is a real answer and is passed on as one,
          // rather than being dressed up as a description.
          if (!seen || !seen.readable || !seen.answer) {
            // Unless the scanner read something the model could not. A
            // photograph of a QR code on a poster is exactly that case: the
            // model sees a square it cannot decode and gives up, while the link
            // inside it is the only thing the sender wanted.
            if (barcodeText) {
              await reply(clampReply(barcodeText), "reply");
              continue;
            }
            await reply(unreadableNotice(answerLanguage, "image"), "unsupported");
            continue;
          }
          await reply(clampReply(barcodeText ? `${seen.answer}\n\n${barcodeText}` : seen.answer), "reply");
          continue;
        } else if (incoming.media.kind === "document") {
          const media = await downloadMedia({
            mediaId: incoming.media.id,
            kind: "document",
            token,
            trace: correlationId,
          });
          if (!media.ok) {
            await reply(mediaFailureNotice(answerLanguage, "document", media.reason), "unsupported");
            continue;
          }

          const read = await understandDocument({
            bytes: media.bytes,
            mimeType: media.mimeType,
            filename: incoming.media.filename,
            question: incoming.media.caption ?? "",
            languageName: LANGUAGE_ENDONYM[answerLanguage],
          });
          if (!read.ok) {
            // Each reason needs a different thing from the sender, so each one
            // says a different thing back. A scan needs a photograph of the
            // page — which this assistant reads well — an empty file needs a
            // different file, a protected one needs an unprotected copy, and a
            // provider fault needs nothing from them at all.
            await reply(
              read.reason === "unreadable_format"
                ? unsupportedDocumentNotice(answerLanguage)
                : read.reason === "scanned_pdf"
                  ? scannedPdfNotice(answerLanguage)
                  : read.reason === "encrypted_pdf"
                    ? encryptedDocumentNotice(answerLanguage)
                    : read.reason === "empty"
                      ? emptyDocumentNotice(answerLanguage)
                      // A Word file or a deck that opened and had no words in
                      // it needs different advice from one that would not open
                      // at all: photograph the page, versus send it as a PDF.
                      : read.reason === "office_no_text"
                        ? emptyOfficeNotice(answerLanguage, officeKind(media.mimeType) ?? "docx")
                        : read.reason === "office_corrupt"
                          ? corruptOfficeNotice(answerLanguage)
                          : read.reason === "no_reader"
                            ? noReaderNotice(answerLanguage, "document")
                            : unreadableNotice(answerLanguage, "document"),
              "unsupported",
            );
            continue;
          }
          if (!read.value.readable || !read.value.answer) {
            await reply(unreadableNotice(answerLanguage, "document"), "unsupported");
            continue;
          }
          await reply(clampReply(read.value.answer), "reply");
          continue;
        } else if (incoming.media.kind === "video") {
          // Checked before the download: with no provider funded to watch it,
          // fetching several megabytes of clip only to refuse is bandwidth
          // spent to arrive at the same sentence.
          if (!VIDEO_READING_AVAILABLE) {
            await reply(noReaderNotice(answerLanguage, "video"), "unsupported");
            continue;
          }

          const media = await downloadMedia({ mediaId: incoming.media.id, kind: "video", token, trace: correlationId });
          if (!media.ok) {
            await reply(mediaFailureNotice(answerLanguage, "video", media.reason), "unsupported");
            continue;
          }
          // Capped far below the media limit: a model reads a video by sampling
          // frames and the cost climbs with length. A support question is
          // answered by a few seconds of screen recording.
          if (media.bytes.byteLength > MAX_VIDEO_BYTES) {
            await reply(videoTooLongNotice(answerLanguage), "unsupported");
            continue;
          }

          const watched = await understandVideo({
            bytes: media.bytes,
            mimeType: media.mimeType,
            question: incoming.media.caption ?? "",
            languageName: LANGUAGE_ENDONYM[answerLanguage],
          });
          if (!watched || !watched.readable || !watched.answer) {
            await reply(unreadableNotice(answerLanguage, "video"), "unsupported");
            continue;
          }
          await reply(clampReply(watched.answer), "reply");
          continue;
        } else {
          await reply(unsupportedTypeNotice(answerLanguage, incoming.media.kind), "unsupported");
          continue;
        }
      } else if (incoming.unsupportedType) {
        await reply(unsupportedTypeNotice(answerLanguage, incoming.unsupportedType), "unsupported");
        continue;
      }

      if (!questionText.trim()) {
        await reply(unsupportedTypeNotice(answerLanguage, incoming.media?.kind ?? "empty"), "unsupported");
        continue;
      }

      // ── The navigation engine ─────────────────────────────────────────
      //
      // Everything about *where the sender is* is decided in
      // `whatsappEngine.ts`, which is pure: it reads the message, the session
      // and the clock, and returns one of three answers. This block performs
      // them and nothing else.
      //
      //   reply       - the engine answered. Send it, save, done.
      //   delegate    - a feature owns this message. Run its handler, inside a
      //                 try/catch that never shows the sender an internal error.
      //   passthrough - not navigation. Fall through to the conversational
      //                 pipeline below, exactly as before this engine existed.
      //
      // The third case is why adding this layer changed nothing that already
      // worked: a customer who has never seen a menu and simply asks a question
      // matches no command and no number, and reaches the same code as always.
      const outcome = runEngine(
        {
          text: questionText,
          kind: engineMessageKind(incoming),
          selection: incoming.selection,
        },
        session,
        {
          language: answerLanguage,
          nowMs: Date.now(),
          timeoutMs: sessionTimeoutMs(),
          available: availableCapabilities(),
          disabled,
          isNewConversation: isNew,
          // The fail-closed flag. Passed to the engine, which passes it to the
          // router, so a tap, a number and a word all meet the same answer.
          configVerified,
        },
      );
      session = outcome.session;

      log("route", {
        outcome: outcome.kind,
        reason: outcome.reason,
        node: currentNodeId(session),
        feature: session.feature,
      });

      if (outcome.kind === "reply") {
        // Standing in the assistant.s own menu is a state, so the transcript and
        // the next delivery both know where the sender is.
        if (currentNodeId(session) === "assistant") session = { ...session, step: AI_MENU };
        // Cancelling has to cancel the thing that is actually pending. The
        // camera modes were armed before this engine existed and keep their own
        // column with its own ten-minute clock, so "#" clears that too —
        // otherwise a cancelled request would still be waiting for a photo, and
        // the next unrelated picture would be answered as if it were this one.
        if (outcome.reason === "cancel_command") {
          await db
            .from("whatsapp_conversations")
            .update({ pending_vision_mode: null, pending_vision_target: null, pending_vision_at: null })
            .eq("id", conversationId);
        }
        for (const message of outcome.replies) {
          if (message.type === "text") await reply(message.text, "reply");
          else await sendMenu(message.nodeId, answerLanguage, { note: message.note });
        }
        await saveSession();
        continue;
      }

      if (outcome.kind === "delegate") {
        const node = outcome.node;
        try {
          // A feature the sender has just opened introduces itself; one they
          // are already inside gets the message. The distinction is the
          // engine's, not each feature's, so no feature has to remember it.
          const opening = outcome.reason === "selection";

          if (node.handler === "ai_ask" || node.handler === "ai_voice") {
            const step = node.handler === "ai_ask" ? AI_TEXT_INPUT : AI_VOICE_INPUT;
            if (opening) {
              // Opening the state and saying so. The step is what makes the
              // *next* message a question rather than a menu command, and it is
              // cleared by the engine's own rules — 0, 00, # and the timeout —
              // so this feature implements none of them again.
              session = {
                ...session,
                step,
                pending: { operation: step, startedAt: new Date().toISOString() },
              };
              await reply(
                assistantSays(node.handler === "ai_ask" ? "askForQuestion" : "askForVoice", answerLanguage),
                "reply",
              );
              await saveSession();
              continue;
            }
            // Already inside: this message is the question. A typed message in
            // the voice state is still answered — insisting on a voice note
            // from somebody who has just typed their question is pedantry.
            await saveSession();
            // falls through to the assistant pipeline
          } else if (node.handler === "ai_new") {
            // A line drawn, not a delete. Everything before stays exactly where
            // it is — the team triaging an escalation still needs it — and the
            // replay simply starts here. The summary goes with it: a summary
            // describes the thread it was written for.
            await db
              .from("whatsapp_conversations")
              .update({
                ai_thread_id: crypto.randomUUID(),
                ai_thread_started_at: new Date().toISOString(),
                summary: null,
                summary_updated_at: null,
                summarized_message_count: 0,
              })
              .eq("id", conversationId);
            log("ai_thread_reset", { state: AI_NEW_CONVERSATION });

            // Left ready for the next question rather than at a menu: somebody
            // who just asked for a new conversation wants to start one.
            session = {
              ...session,
              feature: "assistant.ask",
              path: ["main", "assistant", "assistant.ask"],
              step: AI_TEXT_INPUT,
              pending: { operation: AI_TEXT_INPUT, startedAt: new Date().toISOString() },
              context: {},
            };
            await reply(assistantSays("newThread", answerLanguage), "reply");
            await saveSession();
            continue;
          } else if (node.handler === "help") {
            await reply(say("help", answerLanguage), "reply");
            await saveSession();
            continue;
          } else if (node.handler === "language_menu") {
            // The same list, the same ids, the same builder as the one a new
            // sender meets. Changing your language later is the same act as
            // choosing it the first time, and a second list to maintain would
            // be a second list to let drift.
            await sendLanguageMenu(delivery, 1);
            await saveSession();
            continue;
          } else if (node.handler === "voice_settings") {
            await reply(voiceModeExplainer(noticeLanguage), "reply");
            await saveSession();
            continue;
          } else if (node.handler === "coming_soon") {
            await reply(
              node.intro
                ? localized(node.intro, answerLanguage)
                : comingSoonNotice(answerLanguage, localized(node.title, answerLanguage)),
              "reply",
            );
            await saveSession();
            continue;
          } else if (node.phrase) {
            // A leaf that stands in for words: hand those words to the code
            // that already answers them. This is the whole reason the engine
            // needed to reimplement nothing.
            if (opening) questionText = localized(node.phrase, noticeLanguage);
            await saveSession();
            // falls through, now carrying the phrase
          } else {
            await reply(comingSoonNotice(answerLanguage, localized(node.title, answerLanguage)), "reply");
            await saveSession();
            continue;
          }
        } catch (e) {
          // The sender never sees this. They see a sentence, and they stay
          // exactly where they were: a failed feature must not also lose
          // somebody their place.
          console.error(`[whatsapp] feature ${node.id} failed:`, describeError(e));
          log("feature_error", { node: node.id });
          await reply(featureErrorNotice(answerLanguage), "unsupported");
          await saveSession();
          continue;
        }
      } else {
        await saveSession();
      }

      /**
       * Whether the AI Assistant owns whatever was just sent.
       *
       * Somebody who chose "Ask AI" and then typed «الطقس» asked the assistant
       * about the weather. Answering with a forecast card would be a different
       * feature interrupting a conversation it was never part of — so while the
       * assistant holds the floor, the capability parsers below stand down.
       * They are still reached by everyone else, which is every sender who has
       * not opened the assistant.
       */
      const aiFocused = assistantOwnsInput(session.feature);

      /**
       * Whether a feature may answer at all, by catalog id.
       *
       * The menu path already asks this — the engine refuses a number whose
       * node is off. This is the other door: the words. Somebody who knows to
       * type «الطقس» would otherwise reach the weather while the weather is
       * switched off, and a flag with a way around it is not a flag. Both
       * doors now ask the same function about the same id.
       */
      const featureOn = (id: string) => configVerified && isAvailable(nodeById(id), disabled);


      if (!aiFocused && asksForMenu(questionText)) {
        await sendMenu(ROOT_ID, answerLanguage);
        await saveSession();
        continue;
      }

      // ── Your account, and the orders on it ────────────────────────────
      //
      // The one feature here that has to know *who* is writing, and the only
      // one that refuses to guess. `bazaar_orders.shipping_phone` is free text
      // a buyer typed at checkout and is frequently a courier's or a relative's
      // number, so nothing below ever reads it: a number is bound to an account
      // by a code emailed to that account, or it is bound to nothing and the
      // lookup returns nothing at all.
      //
      // Placed after the engine on purpose. `0`, `#` and the session timeout
      // therefore cancel a half-finished link exactly as they cancel a
      // half-finished upload, and this feature re-implements none of that.
      const accountStep = session.step === ACCOUNT_EMAIL_STEP || session.step === ACCOUNT_CODE_STEP
        ? session.step
        : null;
      const accountIntent = aiFocused ? null : parseAccountIntent(questionText);

      if (!humanOwnsThis && (accountStep || accountIntent)) {
        /** Leaves the flow without leaving the sender anywhere strange. */
        const closeAccountFlow = () => {
          session = { ...session, feature: null, step: null, pending: null };
        };
        const enterAccountStep = (step: string) => {
          session = {
            ...session,
            feature: ACCOUNT_FEATURE,
            path: ["main", "services", ACCOUNT_FEATURE],
            step,
            pending: { operation: step, startedAt: new Date().toISOString() },
          };
        };

        // The words door, the same one every other feature has: a flag with a
        // way around it is not a flag.
        if (!featureOn(ACCOUNT_FEATURE)) {
          await reply(say("unavailable", answerLanguage), "unsupported");
          closeAccountFlow();
          await saveSession();
          continue;
        }

        // An address or a code dictated into a voice note is an address or a
        // code the transcriber guessed at, and one wrong character fails
        // silently. The same refusal onboarding already makes, for the same
        // reason, and only during these two steps.
        if (spokenInput && accountStep) {
          await reply(say("onboardingNeedsText", answerLanguage), "reply");
          await saveSession();
          continue;
        }

        try {
          if (accountIntent === "unlink") {
            const { data: removed, error } = await db.rpc("whatsapp_unlink_identity", {
              _wa_phone: incoming.from,
            });
            if (error) throw error;
            log("account_link", { outcome: removed ? "unlinked" : "not_linked" });
            await reply(say(removed ? "linkUnlinked" : "linkNotLinked", answerLanguage), "reply");
            closeAccountFlow();
            await saveSession();
            continue;
          }

          // The code, while one is outstanding. Read before the intents so that
          // six digits mean the code they were just sent and nothing else.
          if (accountStep === ACCOUNT_CODE_STEP) {
            const typed = readLinkCode(questionText);
            if (typed) {
              const { data: verdict, error } = await db.rpc("whatsapp_link_confirm", {
                _wa_phone: incoming.from,
                _code_hash: await hashLinkCode(typed, appSecret ?? ""),
              });
              if (error) throw error;
              log("account_link", { outcome: String(verdict) });

              if (verdict === "verified") {
                closeAccountFlow();
                await reply(say("linkVerified", answerLanguage), "reply");
                // The error is checked, and that is the whole point of the
                // line. A failed lookup returns no rows, and no rows formats
                // as "there are no orders on your account yet" — which is a
                // confident, wrong answer to somebody who has just proved the
                // account is theirs and is waiting to hear where their parcel
                // is. A failure has to read as a failure.
                const { data: orders, error: lookupError } = await db.rpc("whatsapp_recent_orders", {
                  _wa_phone: incoming.from,
                  _limit: ORDER_PAGE,
                });
                if (lookupError) throw lookupError;
                await reply(formatOrders({ language: answerLanguage, orders: readOrders(orders) }), "reply");
                await saveSession();
                continue;
              }
              if (verdict === "invalid") {
                // The count comes from the database rather than from a counter
                // held here: two deliveries of the same wrong code arriving at
                // once must not spend two of the five tries and report three.
                const { data: state } = await db.rpc("whatsapp_identity_state", {
                  _wa_phone: incoming.from,
                });
                const left = Number((state as { attempts_left?: number } | null)?.attempts_left ?? 0);
                await reply(
                  say("linkCodeWrong", answerLanguage).replace("{n}", String(Math.max(0, left))),
                  "reply",
                );
                await saveSession();
                continue;
              }
              closeAccountFlow();
              await reply(
                say(
                  verdict === "expired"
                    ? "linkCodeExpired"
                    : verdict === "locked"
                    ? "linkCodeLocked"
                    : "linkNoCodePending",
                  answerLanguage,
                ),
                "reply",
              );
              await saveSession();
              continue;
            }
            // Not a code and not an account request: they have moved on. The
            // flow closes quietly and the message is answered by whoever would
            // have answered it anyway — being nagged for a code you have
            // decided not to use is how a feature becomes a trap.
            if (!accountIntent) {
              closeAccountFlow();
              await saveSession();
            }
          }

          if (accountStep === ACCOUNT_EMAIL_STEP && !accountIntent) {
            const address = normaliseEmail(questionText);
            if (!address) {
              // Only a message that was *trying* to be an address is corrected.
              // Anything else means they are talking about something else now.
              if ((questionText ?? "").includes("@")) {
                await reply(say("emailInvalid", answerLanguage), "reply");
                await saveSession();
                continue;
              }
              closeAccountFlow();
              await saveSession();
            } else {
              if (!Deno.env.get("RESEND_API_KEY")) {
                console.error("[whatsapp] account link asked for, but no email provider is configured");
                await reply(featureErrorNotice(answerLanguage), "unsupported");
                closeAccountFlow();
                await saveSession();
                continue;
              }

              const code = generateLinkCode();
              const { data: outcome, error } = await db.rpc("whatsapp_link_request", {
                _wa_phone: incoming.from,
                _email: address,
                _code_hash: await hashLinkCode(code, appSecret ?? ""),
                _ttl_minutes: LINK_CODE_TTL_MINUTES,
              });
              if (error) throw error;
              const status = String((outcome as { status?: string } | null)?.status ?? "sent");
              const deliver = (outcome as { deliver?: boolean } | null)?.deliver === true;
              log("account_link", { outcome: status });

              if (status === "sent" || status === "cooldown") enterAccountStep(ACCOUNT_CODE_STEP);
              else closeAccountFlow();

              await reply(
                say(
                  status === "cooldown"
                    ? "linkCooldown"
                    : status === "throttled"
                    ? "linkThrottled"
                    : status === "already_linked"
                    ? "linkAlreadyLinked"
                    : "linkCodeSent",
                  answerLanguage,
                ),
                "reply",
              );
              await saveSession();

              // Sent after the reply, deliberately. The sender is told the same
              // sentence whether or not there is an account behind the address,
              // and doing the slow part afterwards keeps the *timing* the same
              // too — a reply that arrives late for real accounts and quickly
              // for the rest would answer the question these words refuse to.
              if (status === "sent" && deliver) {
                await sendLinkCodeEmail({ to: address, code, language: answerLanguage });
              }
              continue;
            }
          }

          if (accountIntent === "link" || accountIntent === "orders") {
            const { data: state, error } = await db.rpc("whatsapp_identity_state", {
              _wa_phone: incoming.from,
            });
            if (error) throw error;
            const linked = (state as { linked?: boolean } | null)?.linked === true;

            if (linked && accountIntent === "link") {
              await reply(say("linkAlreadyLinked", answerLanguage), "reply");
              closeAccountFlow();
              await saveSession();
              continue;
            }

            if (linked) {
              const { data: orders, error: lookupError } = await db.rpc("whatsapp_recent_orders", {
                _wa_phone: incoming.from,
                _limit: ORDER_PAGE,
              });
              if (lookupError) throw lookupError;
              closeAccountFlow();
              await reply(formatOrders({ language: answerLanguage, orders: readOrders(orders) }), "reply");
              await saveSession();
              continue;
            }

            enterAccountStep(ACCOUNT_EMAIL_STEP);
            await reply(say("linkAskEmail", answerLanguage), "reply");
            await saveSession();
            continue;
          }
        } catch (e) {
          // Nothing about the failure reaches the sender, and nothing about the
          // sender reaches the log: no address, no code, no order.
          console.error("[whatsapp] account link failed:", describeError(e));
          log("feature_error", { node: ACCOUNT_FEATURE });
          await reply(featureErrorNotice(answerLanguage), "unsupported");
          closeAccountFlow();
          await saveSession();
          continue;
        }
      }

      // ── Where am I, what's around me, what's the weather ───────────────
      //
      // Placed ahead of the visual-assistance modes on purpose. "وين أقرب
      // صيدلية" and "وين مفاتيحي" both open with وين, and only the second is
      // waiting for a photograph — matching the more specific phrase first is
      // what stops "where's the nearest pharmacy" arming the camera and then
      // sitting there for ten minutes waiting for a picture that never comes.
      //
      // Reached with `questionText`, so every one of these works spoken: a
      // voice note has already become text by this point, which for this
      // audience is the difference between a feature and a demo.

      /** The pin on file, if it is recent enough to still be where they are. */
      const rememberedLocation = (() => {
        const at = existing?.last_location_at
          ? Date.parse(existing.last_location_at as string)
          : 0;
        const latitude = existing?.last_latitude as number | null | undefined;
        const longitude = existing?.last_longitude as number | null | undefined;
        if (!at || Date.now() - at > LOCATION_TTL_MS) return null;
        if (!isUsableCoordinate(latitude, longitude)) return null;
        return {
          latitude: latitude as number,
          longitude: longitude as number,
          label: (existing?.last_place as string | null) ?? null,
        };
      })();

      if (asksWhereAmI(questionText) && !humanOwnsThis && !aiFocused && featureOn("services.where")) {
        if (!rememberedLocation) {
          await reply(locationNeededNotice(noticeLanguage), "reply");
          continue;
        }
        // The cached label is why the pin's words were stored at all: asking
        // again should not cost a second round trip to a map service.
        const place = rememberedLocation.label
          ? { locality: null, city: rememberedLocation.label, region: null, country: null }
          : await viaCache(
            reverseKey(rememberedLocation.latitude, rememberedLocation.longitude, noticeLanguage),
            "reverse",
            () => reverseGeocode(rememberedLocation.latitude, rememberedLocation.longitude, noticeLanguage),
          );
        if (!place) {
          await reply(geocodeUnavailableNotice(noticeLanguage), "unsupported");
          continue;
        }
        await reply(
          formatWhereYouAre({
            language: noticeLanguage,
            place,
            latitude: rememberedLocation.latitude,
            longitude: rememberedLocation.longitude,
          }),
          "reply",
        );
        continue;
      }

      if (asksWhatIsNearby(questionText) && !humanOwnsThis && !aiFocused && featureOn("services.nearby")) {
        if (!rememberedLocation) {
          await reply(locationNeededNotice(noticeLanguage), "reply");
          continue;
        }
        const nearby = await viaCache(
          nearbyKey(rememberedLocation.latitude, rememberedLocation.longitude, noticeLanguage),
          "nearby",
          () => fetchNearby(rememberedLocation.latitude, rememberedLocation.longitude, noticeLanguage),
        );
        // `null` is a failed lookup; `[]` is a genuinely unmapped area. Telling
        // somebody standing outside a pharmacy that nothing is near them is
        // false in a way they cannot check for themselves.
        if (nearby === null) {
          await reply(geocodeUnavailableNotice(noticeLanguage), "unsupported");
          continue;
        }
        await reply(
          formatNearby({ language: noticeLanguage, origin: rememberedLocation, places: nearby }),
          nearby.length > 0 ? "reply" : "unsupported",
        );
        continue;
      }

      const weatherRequest = parseWeatherRequest(questionText);
      if (weatherRequest && !humanOwnsThis && !aiFocused && featureOn("services.weather")) {
        let latitude: number;
        let longitude: number;
        let placeName: string;

        if (weatherRequest.place) {
          const geocoded = await viaCache(
            geocodeKey(weatherRequest.place),
            "geocode",
            () => geocodePlace(weatherRequest.place as string),
          );
          if (!geocoded) {
            await reply(placeNotFoundNotice(noticeLanguage, weatherRequest.place), "unsupported");
            continue;
          }
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
          placeName = geocoded.name;
        } else if (rememberedLocation) {
          latitude = rememberedLocation.latitude;
          longitude = rememberedLocation.longitude;
          placeName = rememberedLocation.label ?? "";
        } else {
          // No city named and no pin on file. Asking is the only honest move:
          // a forecast for the wrong continent reads exactly like a right one.
          await reply(weatherNeedsPlaceNotice(noticeLanguage), "reply");
          continue;
        }

        const reading = await viaCache(
          weatherKey(latitude, longitude, Date.now()),
          "weather",
          () => fetchWeather(latitude, longitude),
        );
        if (!reading) {
          await reply(weatherUnavailableNotice(noticeLanguage), "unsupported");
          continue;
        }
        if (!placeName) {
          const place = await viaCache(
            reverseKey(latitude, longitude, noticeLanguage),
            "reverse",
            () => reverseGeocode(latitude, longitude, noticeLanguage),
          );
          placeName = place ? shortPlaceLabel(place) : "";
        }
        await reply(
          formatWeather({
            language: noticeLanguage,
            placeName: placeName || (language === "ar" ? "موقعك" : "your location"),
            current: reading.current,
            daily: reading.daily,
            includeForecast: weatherRequest.forecast,
          }),
          "reply",
        );
        continue;
      }

      // ── Visual assistance: the five modes ─────────────────────────────
      //
      // Reached with `questionText`, so it may be a transcribed voice note or
      // a menu row. Saying "read this" and then taking a photo is the flow
      // that actually works one-handed with a screen reader running — typing a
      // caption while aiming a camera is the step this audience can least
      // afford, and tapping row 4 is one step fewer still.
      const visionRequest = aiFocused || !featureOn("ocr") ? null : parseVisionMode(questionText);
      if (visionRequest) {
        // Translation is the one mode that does not need a picture: when the
        // text came with the request, answer it now rather than asking for a
        // photo that was never coming.
        if (visionRequest.mode === "translate" && visionRequest.inlineText) {
          try {
            const { result: stream } = await streamChatCompletionWithFallback({
              targets: getAssistant("whatsapp-support")?.targets ?? [],
              system: translateTextPrompt(LANGUAGE_ENDONYM[answerLanguage], visionRequest.target),
              messages: [{ role: "user", content: visionRequest.inlineText }],
              maxTokens: 700,
            });
            const translated = clampReply(await collectStream(stream));
            await reply(translated || failureNotice(answerLanguage), translated ? "reply" : "handover");
          } catch (e) {
            console.error("[whatsapp] translation failed:", describeError(e));
            await reply(failureNotice(answerLanguage), "handover");
          }
          continue;
        }

        await db
          .from("whatsapp_conversations")
          .update({
            pending_vision_mode: visionRequest.mode,
            pending_vision_target: visionRequest.target,
            pending_vision_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
        await reply(awaitingImageNotice(language, visionRequest.mode, visionRequest.target), "reply");
        continue;
      }

      // ── Buying and selling ────────────────────────────────────────────
      //
      // Placed after the visual modes so "دوّر على مفاتيحي" keeps meaning the
      // camera, and answered from the tables rather than the knowledge base
      // because embedded prose does not know today's price or whether a thing
      // is in stock — and a model asked anyway will supply both.
      const bazaarRequest = aiFocused || !featureOn("services.bazaar") ? null : parseBazaarRequest(questionText);
      /**
       * Set when a weak shopping guess found nothing, so the message falls
       * through to the ordinary assistant instead of being answered.
       *
       * The alternative is telling somebody who asked "do you have a number I
       * can call" that no products matched — technically true, and useless.
       */
      let bazaarFellThrough = false;
      if (bazaarRequest && !humanOwnsThis) {
        if (bazaarRequest.intent === "sell") {
          await reply(sellGuidance(noticeLanguage), "reply");
          continue;
        }

        try {
          if (bazaarRequest.intent === "browse") {
            const { count } = await db
              .from("bazaar_products")
              .select("id, bazaar_shops!inner(id)", { count: "exact", head: true })
              .eq("bazaar_shops.is_active", true);
            await reply(browseNotice(noticeLanguage, count ?? 0), "reply");
            continue;
          }

          // Every term has already been stripped of everything that is not a
          // letter, a digit or a space by `searchTerms`, which is what makes
          // interpolating them into a PostgREST filter safe: a comma, a
          // parenthesis or a quote cannot survive that far.
          const filter = bazaarRequest.terms
            .flatMap((term) => [`name.ilike.%${term}%`, `description.ilike.%${term}%`])
            .join(",");

          const { data: rows, error } = await db
            .from("bazaar_products")
            .select("name, description, price, in_stock, bazaar_shops!inner(name, is_active)")
            .or(filter)
            .eq("bazaar_shops.is_active", true)
            .limit(25);
          if (error) throw error;

          type Row = {
            name: string; description: string | null; price: number; in_stock: boolean | null;
            bazaar_shops: { name: string | null } | { name: string | null }[] | null;
          };

          // OR at the database and ranked here, rather than AND at the
          // database. "زيت زيتون" against a listing called "زيت الزيتون"
          // matches both terms and should lead; a listing matching one term
          // should still appear rather than vanishing into an empty result.
          const scored = ((rows ?? []) as Row[])
            .map((row) => {
              const haystack = `${row.name} ${row.description ?? ""}`.toLowerCase();
              const hits = bazaarRequest.terms.filter((term) => haystack.includes(term)).length;
              const shop = Array.isArray(row.bazaar_shops) ? row.bazaar_shops[0] : row.bazaar_shops;
              const listing: BazaarListing = {
                name: row.name,
                description: row.description,
                price: Number(row.price),
                inStock: row.in_stock !== false,
                shopName: shop?.name ?? null,
              };
              return { listing, hits };
            })
            // In-stock first among equally relevant listings: "we have it" is
            // a better answer than "we had it" when both are true.
            .sort((a, b) => b.hits - a.hits || Number(b.listing.inStock) - Number(a.listing.inStock))
            .slice(0, 5)
            .map((entry) => entry.listing);

          if (scored.length > 0) {
            await reply(
              formatListings({ language: noticeLanguage, listings: scored, terms: bazaarRequest.terms }),
              "reply",
            );
          } else if (bazaarRequest.confident) {
            await reply(noListingsNotice(noticeLanguage, bazaarRequest.terms), "unsupported");
          } else {
            console.log("[whatsapp] weak bazaar guess found nothing — handing back to the assistant");
            bazaarFellThrough = true;
          }
        } catch (e) {
          console.error("[whatsapp] bazaar lookup failed:", describeError(e));
          // A database fault is worth saying out loud to somebody who clearly
          // meant the shop, and worth swallowing for somebody who probably did
          // not — they get the assistant, which is what they wanted anyway.
          if (bazaarRequest.confident) {
            await reply(bazaarUnavailableNotice(noticeLanguage), "unsupported");
          } else {
            bazaarFellThrough = true;
          }
        }
        if (!bazaarFellThrough) continue;
      }

      // ── Triage ────────────────────────────────────────────────────────
      //
      // A label, not an answer: it never blocks the reply, and an unclassified
      // message is a normal state. The obvious cases skip the model entirely.
      const askedForHuman = userAskedForHuman(questionText);
      let category: Category | null = quickCategory({
        text: questionText,
        askedForHuman,
        hasMedia: !!incoming.media,
      });
      // ── Ask locally before paying anybody to read it ────────────────────
      //
      // A category is a routing label: never shown to the customer, never part
      // of an answer, and an unclassified message is already a state this
      // function handles. So it is the safest thing to answer without a model,
      // and until now every message `quickCategory` could not settle cost a
      // provider round trip to produce a word nobody reads.
      //
      // `localCategory` returns a label only when it is confident, and holds
      // `complaint` — one of the two labels that escalate to a person — to a
      // higher bar than the rest. Everything below the floor falls through to
      // exactly the call that was being made before, so this can save a call
      // but cannot cost an answer.
      if (!category) {
        const local = localCategory({ text: questionText });
        if (local.category) category = local.category;
        log("classified", {
          reason: local.category ? "local" : "deferred",
          category: local.category ?? undefined,
          // A count and a rounded score. Never the message.
          count: local.matched,
          status: Math.round(local.confidence * 100),
        });
      }

      if (!category) {
        // A label, on a clock. Classification does not gate the reply — an
        // unclassified message is a normal state — so a provider that hangs
        // must cost the label and nothing else. `withDeadline` returns null
        // for both a timeout and a failure, because the answer to each is the
        // same: carry on without it.
        const classified = await withDeadline(
          () => structuredCompletionWithFallback({
            targets: CLASSIFY_TARGETS,
            system: CLASSIFY_INSTRUCTION,
            userText: questionText.slice(0, 1_000),
            schema: CLASSIFY_SCHEMA as unknown as Record<string, unknown>,
            toolName: "classify_message",
            maxTokens: 24,
          }),
          CLASSIFY_TIMEOUT_MS,
          (error, timedOut) => log.fail("classify_failed", error, { reason: timedOut ? "timeout" : "error" }),
        );
        const label = (classified?.result as { category?: unknown } | null)?.category;
        if (isCategory(label)) category = label;
      }
      if (category) {
        await db.from("whatsapp_messages").update({ category }).eq("wa_message_id", incoming.messageId);
        await db.from("whatsapp_conversations").update({ last_category: category }).eq("id", conversationId);
      }
      console.log(`[whatsapp] category=${category ?? "none"}`);

      /** Escalate, and leave a briefing so the customer need not repeat themselves. */
      const escalate = async (reason: EscalationReason) => {
        let briefing: string | null = null;
        try {
          const { data: recent } = await db
            .from("whatsapp_messages")
            .select("direction, body, kind")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(20);
          const material = (recent ?? [])
            .reverse()
            .map((row) => `${row.direction === "inbound" ? "Customer" : "Assistant"}: ${row.body}`)
            .join("\n")
            .slice(0, 8_000);
          if (material) {
            // Bounded, because staff never see a blank briefing field anyway:
            // `fallbackBriefing` fills it below. Waiting indefinitely for a
            // nicer summary of a conversation that has already been escalated
            // is the least valuable thing this function could be doing.
            const drafted = await withDeadline(
              async () => {
                const { result: stream } = await streamChatCompletionWithFallback({
                  targets: SUMMARY_TARGETS,
                  system: HANDOFF_INSTRUCTION,
                  messages: [{ role: "user", content: material }],
                  maxTokens: 240,
                });
                return redactSummary(await collectStream(stream));
              },
              BRIEFING_TIMEOUT_MS,
              (error, timedOut) => log.fail("briefing_failed", error, { reason: timedOut ? "timeout" : "error" }),
            );
            briefing = drafted;
          }
        } catch (e) {
          console.error("[whatsapp] handoff briefing failed:", describeError(e));
        }

        await db
          .from("whatsapp_conversations")
          .update({
            escalated: true,
            escalated_at: new Date().toISOString(),
            escalation_reason: reason,
            // Staff never see a blank briefing field.
            handoff_summary: briefing || fallbackBriefing(reason, questionText),
            handoff_summary_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      };

      // An explicit request for a person is honoured immediately — the model
      // does not get to talk the user out of it.
      if (askedForHuman) {
        await escalate("user_request");
        await reply(handoverNotice(answerLanguage), "handover");
        continue;
      }

      // Once a human owns the conversation, the bot stops answering so the
      // user is not talking to both at once. `control` is the explicit
      // owner-set state; `escalated` is the automatic one. Either silences
      // the assistant, and only the owner can hand control back.
      if (existing?.control === "human" || existing?.escalated) continue;

      // ── The assistant's own input rules ───────────────────────────────
      //
      // Checked here rather than at the top of the webhook because this is the
      // only path that spends money on the message: a question too long to
      // answer is a question worth refusing before a provider reads it, and an
      // empty one is worth refusing before a model is asked to answer nothing.
      const limits = assistantLimits();
      const checked = checkQuestion(questionText, limits);
      if (!checked.ok) {
        await reply(
          assistantSays(checked.problem === "empty" ? "emptyQuestion" : "tooLong", answerLanguage),
          "unsupported",
        );
        log("ai_input_rejected", { problem: checked.problem, chars: questionText.length });
        await saveSession();
        continue;
      }
      questionText = checked.question;

      // ── Ask the existing assistant ────────────────────────────────────
      //
      // Scoped to the current thread. "New conversation" moves
      // `ai_thread_started_at` forward and nothing before it is replayed —
      // which is the whole of what that button does, since none of it is
      // deleted.
      const threadStartedAt = (existing?.ai_thread_started_at as string | null) ?? null;
      const threadFilter = <T extends { gte: (column: string, value: string) => T }>(query: T): T =>
        threadStartedAt ? query.gte("created_at", threadStartedAt) : query;

      const { data: history } = await threadFilter(
        db
          .from("whatsapp_messages")
          .select("direction, body, kind")
          .eq("conversation_id", conversationId),
      )
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);


      const turns = budgetTurns(
        (history ?? [])
          .filter((row) => row.kind === null || row.kind === "reply")
          .reverse()
          .map((row) => ({
            role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
            content: row.body as string,
          })),
      );

      // ── Rolling summary ───────────────────────────────────────────────
      //
      // Older turns are condensed once and replayed as background, so a long
      // conversation stays coherent without every message carrying its whole
      // history. Refreshed on a message count, not on every turn.
      const { count: inboundCount } = await threadFilter(
        db
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound"),
      );

      let summary = (existing?.summary as string | null) ?? null;
      if (needsSummary({
        inboundCount: inboundCount ?? 0,
        summarizedCount: (existing?.summarized_message_count as number) ?? 0,
        hasSummary: !!summary,
      })) {
        try {
          const { data: older } = await threadFilter(
            db
              .from("whatsapp_messages")
              .select("direction, body, kind")
              .eq("conversation_id", conversationId),
          )
            .order("created_at", { ascending: false })
            .range(HISTORY_LIMIT, HISTORY_LIMIT + 60);

          const material = (older ?? [])
            .filter((row) => row.kind === null || row.kind === "reply")
            .reverse()
            .map((row) => `${row.direction === "inbound" ? "Customer" : "Assistant"}: ${row.body}`)
            .join("\n")
            .slice(0, 12_000);

          if (material) {
            // A summary is an optimisation. Losing it costs context, not the
            // reply — so it gets a clock, and a provider that hangs here does
            // not hold up the answer the customer is actually waiting for.
            const drafted = await withDeadline(
              async () => {
                const { result: stream } = await streamChatCompletionWithFallback({
                  targets: SUMMARY_TARGETS,
                  system: SUMMARY_INSTRUCTION,
                  messages: [{ role: "user", content: material }],
                  maxTokens: 260,
                });
                return redactSummary(await collectStream(stream));
              },
              SUMMARY_TIMEOUT_MS,
              (error, timedOut) => log.fail("summary_failed", error, { reason: timedOut ? "timeout" : "error" }),
            );
            if (drafted) {
              summary = drafted;
              await db.from("whatsapp_conversations").update({
                summary: drafted,
                summary_updated_at: new Date().toISOString(),
                summarized_message_count: inboundCount ?? 0,
              }).eq("id", conversationId);
            }
          }
        } catch (e) {
          // A summary is an optimisation. Losing it costs context, not the reply.
          console.error("[whatsapp] summary refresh failed:", describeError(e));
        }
      }

      const assistant = getAssistant("whatsapp-support");
      if (!assistant) throw new Error("whatsapp-support assistant is not registered");

      const answerIn = answerLanguage;

      // ── Grounding ─────────────────────────────────────────────────────
      //
      // Without retrieved material the model answers Visionex questions from
      // its priors, and a confident invented refund policy is worse than "I
      // don't know" because the customer acts on it. A weak match is worse
      // still: it reads as authoritative while being about something else, so
      // anything below the similarity floor is discarded and the model is told
      // it has no source.
      // Every bound lives in `whatsappKnowledge.ts` — query length, candidate
      // rows, passages kept, characters per passage and in total, the trusted
      // source list, and a wall-clock deadline over the whole thing. Nothing
      // throws out of it: a slow embedding provider or a database that will not
      // answer costs the grounding and never the reply, and the no-passage
      // directive is the *safe* state rather than the degraded one.
      const grounding = await retrieveKnowledge(questionText, {
        embed: async (text) => (await createEmbedding([text]))[0] ?? [],
        match: async (vector, limit) => {
          const { data, error } = await db.rpc("match_embeddings", {
            query_embedding: vector,
            match_count: limit,
          });
          if (error) throw error;
          return (data ?? []) as MatchRow[];
        },
      });
      const passages = grounding.passages;
      log("grounding", {
        status: grounding.status,
        passages: passages.length,
        candidates: grounding.candidates,
        ms: grounding.ms,
        ...(grounding.status === "degraded" ? { reason: grounding.reason } : {}),
      });

      // One notice, before the call and never inside a retry: two "working on
      // it" messages read as stuck rather than busy. Filed as canned text so it
      // never returns to the model as a turn, and never spoken — a notification
      // sound saying "hold on" is not worth a voice note.
      if (shouldAnnounceWork(questionText, limits, spokenInput)) {
        await reply(assistantSays("working", answerLanguage), "unsupported");
      }

      session = { ...session, step: AI_PROCESSING };
      await saveSession();

      /**
       * The little the model is told about who it is talking to.
       *
       * A first name, a language and a country — the three facts that change an
       * answer. Not the email, not the date of birth, not the gender, and not
       * the phone number: none of them make an answer better, and all of them
       * would then be sitting in a provider's request log. `userContext` is the
       * only door out of the profile, so this is narrow by construction rather
       * than by somebody remembering to redact.
       *
       * Null when there is nothing worth saying, which is what a sender with no
       * profile gets — rather than a sentence full of "unknown" that a model
       * will cheerfully read back to them.
       */
      const persona = personalizationDirective(
        userContext(readProfile(incoming.from, existing as Record<string, unknown> | null), answerIn),
      );

      // The ask itself is one call with the provider handed to it. Production
      // passes the registry's chain; the suite passes a function that returns
      // what the case needs. Nothing here knows which it has, and no
      // environment variable decides — that is what makes the failure, timeout
      // and empty-answer paths testable rather than merely written down.
      const asked = await askAssistant(
        {
          systemParts: [
            assistant.systemPrompt,
            languageDirective(answerIn),
            persona,
            // The catalog, not the retrieved prose, is what this channel can
            // do — filtered by exactly the flags and capabilities that decide
            // whether a tap would work, so the list the model is given and the
            // menu the sender is shown cannot disagree.
            catalogDirective(availableFeatures(answerIn, disabled, availableCapabilities())),
            // Weather, OCR, location, the bazaar and the handover read live
            // data at the moment they are asked. A passage embedded last month
            // does not, and a model handed both will prefer the prose.
            HANDLER_AUTHORITY_DIRECTIVE,
            knowledgeDirective(passages),
            verbosityDirective(existing?.verbosity as string | null),
          ],
          summary,
          turns,
          question: questionText,
        },
        chainProvider(),
      );

      // Out of AI_PROCESSING on every path out of the ask: a state a sender can
      // enter and not leave is worse than no state at all.
      session = {
        ...session,
        step: assistantOwnsInput(session.feature) ? AI_CONVERSATION : null,
        pending: null,
      };

      if (asked.status !== "answered") {
        if (asked.status === "failed") {
          // A reason and a status number. Never a message, never a stack: a
          // provider's error body can quote the prompt back, and the prompt
          // contains the customer's message.
          console.error(`[whatsapp] provider ${asked.reason}:`, asked.httpStatus || "unknown");
          log("ai_failed", { reason: asked.reason, status: asked.httpStatus, ms: asked.ms });
          await escalate("ai_unavailable");
        } else {
          // Answered with nothing. WhatsApp rejects an empty message, and a
          // blank bubble is a worse answer than an apology.
          log("ai_empty", { provider: asked.provider, ms: asked.ms });
        }
        await reply(failureNotice(answerLanguage), "handover");
        await saveSession();
        continue;
      }

      log("ai_answered", {
        provider: asked.provider,
        model: asked.model,
        ms: asked.ms,
        chars: asked.text.length,
      });
      const answer = asked.text;

      // Split rather than truncated. A cut-off answer is worse than a long one,
      // and the parts are sent in order, each ending somewhere a reader can
      // stop. The ceiling is configurable and bounded; nothing past the last
      // part is sent, because the prompt asks for brevity in the first place.
      // A typed answer is split to WhatsApp's text ceiling. A spoken one is
      // not: that ceiling is about text, `speechSegments` does the bounding for
      // audio, and three text parts each becoming three voice notes would be
      // nine voice notes for one question. The answer itself was generated
      // exactly once either way — this only chooses how it travels.
      const parts = spokenInput ? [answer] : splitAnswer(answer, limits);
      for (const part of parts) await reply(part, "reply");
      if (parts.length > 1) log("ai_split", { parts: parts.length });
      await saveSession();

      // The model was told to say it is handing over when it cannot help.
      // Flag the conversation so the team sees it in the queue.
      if (replySignalsHandover(answer)) {
        await escalate("assistant_handover");
        continue;
      }

      // ── Escalating without being asked ────────────────────────────────
      //
      // A complaint, a payment or access problem, or an assistant that has
      // failed several turns running. Deliberately conservative: escalating a
      // routine question wastes a person's time, but missing a complaint costs
      // a customer. Checked after the reply, so the customer is answered first.
      const { data: recentOutbound } = await db
        .from("whatsapp_messages")
        .select("kind")
        .eq("conversation_id", conversationId)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(3);
      const consecutiveDeclines = (recentOutbound ?? [])
        .findIndex((row) => row.kind === "reply") === -1
        ? (recentOutbound ?? []).length
        : 0;

      const reason = shouldEscalate({ category, consecutiveDeclines, text: questionText });
      if (reason) {
        console.log(`[whatsapp] escalating unprompted: ${reason}`);
        await escalate(reason);
      }
    } catch (e) {
      // One bad message must not drop the rest of the batch — and a message
      // that failed is deliberately left claimed but unfinished, so Meta's
      // redelivery rescues it instead of discarding it as a duplicate.
      handlingFailed = true;
      console.error("[whatsapp] failed to handle a message:", describeError(e));
    } finally {
      // Reached by every ordinary way out of the block above, `continue`
      // included — which is what makes this the one place the claim is closed,
      // rather than a line that has to be repeated at each of the thirty-odd
      // exits and will eventually be forgotten at one of them.
      //
      // Its own try/catch: a failure to record that the work finished must not
      // become a failure of the batch. The cost of losing this write is one
      // redelivery re-answering the message after the recovery window, which is
      // the safe direction.
      if (claimedMessageId && !handlingFailed) {
        try {
          await db
            .from("whatsapp_messages")
            .update({ processing_state: "done" })
            .eq("wa_message_id", claimedMessageId);
        } catch (e) {
          console.error("[whatsapp] could not close the processing claim:", describeError(e));
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
});
