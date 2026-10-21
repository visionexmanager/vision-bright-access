// Who may run which operation, and what it costs us if they do.
//
// ONE declaration of the trial / cost policy. It does not replace the
// enforcement that already exists on the server — `ai_subscription_gate`
// (20261062), `plan_for_user` / `user_sections` (20261063), the VX meter, the
// daily limits — and it does not hold a price, a plan or a VX figure: plans come
// from `lib/billing/plans.ts`, which stays the only source. What this adds is
// the thing that was missing: a written, tested answer to "does this operation
// reach a paid external provider, and if so what must be true first?", per Edge
// Function and per user-facing operation.
//
//   A  free in the trial   stored or local content; no provider call, no
//                          incremental cost beyond serving a row or a file.
//   B  free, with limits   Visionex's own CPU, database or bandwidth; negligible
//                          cost, bounded by rate and payload limits.
//   C  identity            needs an account or a verified signature (payments,
//                          private data, consent); grants no provider access.
//   D  paid provider       may call a paid external service. Never in the trial.
//                          Identity -> plan -> VX/budget -> provider, in that
//                          order, on the server.
//   R  needs review        the incremental cost is not established. Treated as
//                          closed until someone looks.
//
// The rule that holds the table honest is tested, not asserted: a function whose
// source reaches a paid provider can never be classified A, B or C
// (`src/test/access-policy.test.ts`), a D function must carry the guard its row
// names, and a function that is not in the table fails the build.

import {
  PAID_PLAN_ORDER, planAllows, sectionForPath, TRIAL_SECTIONS,
  type SectionKey,
} from "@/lib/billing/plans";

export type AccessClass = "A" | "B" | "C" | "D" | "R";

/** How a function proves the caller may use it. Each is checked against the source by the test. */
export type Guard =
  | "none"          // intentionally public (read-only or rate-limited public form)
  | "jwt"           // a verified user session
  | "signature"     // a provider webhook signature
  | "cron"          // CRON_SECRET
  | "admin"         // has_role(admin)
  | "owner"         // the owner console
  | "ai_gate"       // subscriptionGate -> ai_subscription_gate
  | "voice_guard"   // guardVoiceRequest (identity, plan, limit)
  | "webhook_gate"  // requireActiveSubscription for a WhatsApp/Messenger sender
  | "unverified";   // not proven in this audit: listed, counted, and capped by a test

export interface EdgePolicy {
  cls: AccessClass;
  guard: Guard;
  /** May an account that is only inside its free week call it? */
  trial: boolean;
  note: string;
}

/** Every Edge Function, classified. A new directory under supabase/functions fails the build until it is added. */
export const EDGE_POLICY: Readonly<Record<string, EdgePolicy>> = {
  "academy-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "ai-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "ai-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "ai-search": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "ai-voice-chat": { cls: "D", guard: "voice_guard", trial: false, note: "Voice request guard: identity, plan, limit, then provider." },
  "analytics-insights": { cls: "D", guard: "admin", trial: false, note: "Admin-only OpenAI summary of analytics." },
  "analyze-image": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "analyze-meal": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "bazaar-checkout": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "bazaar-notify-seller": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "bazaar-stripe-connect": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "bazaar-stripe-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "billing-engine": { cls: "C", guard: "unverified", trial: false, note: "Subscription and order logic." },
  "career-ai": { cls: "D", guard: "ai_gate", trial: false, note: "Career AI; gated through its shared handler (handleStructuredCareerAiRequest)." },
  "career-billing-checkout": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "career-billing-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "career-gdpr-request": { cls: "C", guard: "unverified", trial: false, note: "Data-protection requests." },
  "career-system-health": { cls: "R", guard: "unverified", trial: false, note: "Lists Gemini models with a key. Caller auth not verified in this audit." },
  "contact-form": { cls: "B", guard: "none", trial: true, note: "Public form; sends one e-mail. Anonymous allowed with its own limits." },
  "document-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "embed-content": { cls: "D", guard: "admin", trial: false, note: "Admin-only embedding of site content." },
  "enrich-product": { cls: "D", guard: "admin", trial: false, note: "Admin-only product enrichment (OpenAI)." },
  "file-convert": { cls: "B", guard: "ai_gate", trial: false, note: "Runs on Visionex own server (CPU, bandwidth); gated and limited to 10/day." },
  "generate-diet-plan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "health-check": { cls: "D", guard: "admin", trial: false, note: "Anonymous callers get the free key listing only; the paid generation probe is admin-only." },
  "image-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "image-tools-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "kids-ai-teacher": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "kids-course-generate": { cls: "D", guard: "admin", trial: false, note: "Admin-only course generation." },
  "kids-drawing-to-art": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "kids-issue-certificate": { cls: "C", guard: "unverified", trial: false, note: "Issues a certificate." },
  "kids-story-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-classify-book": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-search": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-writing-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-book-analytics": { cls: "B", guard: "unverified", trial: true, note: "Reading analytics from the database." },
  "library-build-knowledge-graph": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-checkout-session": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "library-crypto-checkout": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "library-crypto-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-detect-series": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-embed-book": { cls: "D", guard: "ai_gate", trial: false, note: "Gated; produces or indexes content with a provider or heavy compute." },
  "library-generate-flashcard-deck": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-narration": { cls: "D", guard: "ai_gate", trial: false, note: "Gated; produces or indexes content with a provider or heavy compute." },
  "library-generate-practice-exam": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-quotes": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-reading-plan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-import-book": { cls: "B", guard: "unverified", trial: false, note: "Fetches and stores external files: bandwidth and storage on Visionex; not offered to the trial." },
  "library-issue-certificate": { cls: "C", guard: "unverified", trial: false, note: "Issues a certificate." },
  "library-librarian-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-librarian-daily-plan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-librarian-privacy": { cls: "C", guard: "unverified", trial: true, note: "Privacy settings for the librarian." },
  "library-librarian-recommendations": { cls: "B", guard: "jwt", trial: true, note: "Database-only recommendations; per-user daily limit, no provider." },
  "library-librarian-summary": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-paypal-checkout": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "library-paypal-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-process-background-jobs": { cls: "D", guard: "cron", trial: false, note: "Scheduled (CRON_SECRET); processes queued jobs." },
  "library-purchase-book": { cls: "C", guard: "unverified", trial: false, note: "Checkout or marketplace action; needs an account." },
  "library-recommend-books": { cls: "B", guard: "jwt", trial: true, note: "Database-only recommendations." },
  "library-recommend-community": { cls: "B", guard: "unverified", trial: true, note: "Database-only recommendations." },
  "library-research-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-reward-vx": { cls: "C", guard: "unverified", trial: true, note: "Awards VX through the self-award allowance." },
  "library-semantic-search": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-stripe-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-summarize-discussion": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-sync-progress": { cls: "C", guard: "unverified", trial: true, note: "Reading progress sync." },
  "library-track-reading": { cls: "C", guard: "unverified", trial: true, note: "Reading time tracking." },
  "library-translate-book-metadata": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-translate-comment": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "livekit-token": { cls: "R", guard: "jwt", trial: false, note: "Mints a LiveKit room token for any signed-in user. LiveKit minutes may be billed by the host; the section (messages/voice rooms) needs Pro but the function does not check it." },
  "meta-messaging-webhook": { cls: "D", guard: "webhook_gate", trial: false, note: "Messenger/Instagram webhook; AI answers need an active plan." },
  "mobility": { cls: "R", guard: "jwt", trial: false, note: "Calls keyless map services and travel partners; costs not established." },
  "moderate-content": { cls: "B", guard: "jwt", trial: true, note: "Calls the free OpenAI moderation endpoint (no charge); signed-in only. Deliberately outside the subscription gate so child safety checks keep working." },
  "news-generate": { cls: "D", guard: "cron", trial: false, note: "Scheduled (CRON_SECRET) or admin; never a user request." },
  "newsletter-preferences": { cls: "C", guard: "unverified", trial: true, note: "Subscription preferences." },
  "ocr-scan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "organization-ai-admin": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "owner-control": { cls: "D", guard: "owner", trial: false, note: "Owner/admin console, can run AI." },
  "provider-hub": { cls: "D", guard: "admin", trial: false, note: "Admin or CRON_SECRET; provider registry and model discovery." },
  "radar-ai": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "radio-stream-token": { cls: "B", guard: "unverified", trial: false, note: "Mints a stream token; bandwidth through Visionex stream proxy. Section needs a paid plan." },
  "realtime-session": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "send-email": { cls: "C", guard: "jwt", trial: false, note: "Sends e-mail through the mail provider; signed-in only." },
  "social-oauth": { cls: "C", guard: "unverified", trial: false, note: "Connects owner social accounts." },
  "social-publish": { cls: "D", guard: "cron", trial: false, note: "Scheduled publishing (CRON_SECRET) and owner actions; uses AI for captions and images." },
  "speech-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "speech-transcribe": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "text-to-speech": { cls: "D", guard: "voice_guard", trial: false, note: "Voice request guard: identity, plan, limit, then provider." },
  "text-tools-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "trial-billing": { cls: "C", guard: "cron", trial: false, note: "Scheduled trial reminders and expiry e-mails." },
  "tv-stream-token": { cls: "B", guard: "unverified", trial: false, note: "Same as radio." },
  "tv-validate-stream": { cls: "B", guard: "unverified", trial: false, note: "Validates stream availability." },
  "video-studio": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "voice-studio": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "vx-coin-review": { cls: "C", guard: "unverified", trial: true, note: "VX review actions." },
  "whatsapp-webhook": { cls: "D", guard: "webhook_gate", trial: false, note: "WhatsApp webhook; AI answers need an active plan. Local menus/audio for the trial are NOT yet served: the gate stays silent for them." },
};

// ── User-facing operations ──────────────────────────────────────────────────

export type VxMode = "none" | "shadow" | "fixed" | "metered";

export interface OperationPolicy {
  id: string;
  section: SectionKey | null;
  cls: AccessClass;
  requiresAuth: boolean;
  trialAllowed: boolean;
  /** May this operation, on any path including fallbacks, call a paid external service? */
  paidProvider: boolean;
  /** Needs an active paid plan (ai_user_entitled) before the provider is reached. */
  needsPaidPlan: boolean;
  vx: VxMode;
  /** A stored answer or file is served instead of a provider call when one exists. */
  localFallback: boolean;
  edge: readonly string[];
  limits: string;
}

const op = (o: OperationPolicy): OperationPolicy => o;

export const OPERATIONS: readonly OperationPolicy[] = [
  op({ id: "library.read", section: "library", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: ["library-track-reading", "library-sync-progress"], limits: "RLS on books; reading-progress writes are the user's own rows" }),
  op({ id: "library.saved_answer", section: "library", cls: "A", requiresAuth: true, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: true, edge: ["library-ai-assistant"], limits: "served from library_ai_summaries / library_ai_content_cache before any gate, limit or provider; read through the caller's own RLS session" }),
  op({ id: "library.audio_playback", section: "library", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "stored audio files; playing one calls no provider" }),
  op({ id: "academy.content", section: "academy", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "lessons and exercises from the database" }),
  op({ id: "arcade.play", section: "arcade", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "games run in the browser; VX spent on a game is an internal ledger entry" }),
  op({ id: "news.read", section: "news", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "articles are generated by a scheduled job, not per reader" }),
  op({ id: "assistive.catalogue", section: "assistive", cls: "A", requiresAuth: false, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "catalogue rows" }),
  op({ id: "community.post", section: "community", cls: "B", requiresAuth: true, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: ["moderate-content"], limits: "moderation uses OpenAI's free moderation endpoint; signed-in only" }),
  op({ id: "files.convert", section: "professional", cls: "B", requiresAuth: true, trialAllowed: false, paidProvider: false, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["file-convert"], limits: "own server CPU and bandwidth; 10/day, 16 MB" }),
  op({ id: "stream.tv_radio", section: "tv", cls: "B", requiresAuth: true, trialAllowed: false, paidProvider: false, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["tv-stream-token", "radio-stream-token"], limits: "bandwidth through the stream proxy" }),
  op({ id: "account.manage", section: null, cls: "C", requiresAuth: true, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: ["billing-engine", "newsletter-preferences"], limits: "own profile and settings" }),
  op({ id: "checkout.subscription", section: null, cls: "C", requiresAuth: true, trialAllowed: true, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: [], limits: "manual checkout; an admin approves the order" }),
  op({ id: "assistant.chat", section: "assistant", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "shadow", localFallback: false, edge: ["ai-chat", "academy-chat", "ai-generate"], limits: "60/day per user; budget; metering in shadow mode" }),
  op({ id: "library.ai_generate", section: "library", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: true, edge: ["library-ai-assistant", "library-ai-chat", "library-generate-flashcard-deck"], limits: "40/day on library-ai-assistant; a stored answer is returned first" }),
  op({ id: "voice.tts", section: "mediaStudio", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "fixed", localFallback: true, edge: ["text-to-speech", "speech-generate", "library-generate-narration"], limits: "20/day; stored audio is played without a provider" }),
  op({ id: "voice.stt", section: "assistant", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["speech-transcribe"], limits: "30/day" }),
  op({ id: "voice.realtime", section: "messages", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["realtime-session"], limits: "10 sessions/day; optional monthly minutes (billing_plans.limits.realtime_monthly_minutes)" }),
  op({ id: "image.generate", section: "mediaStudio", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "fixed", localFallback: false, edge: ["image-generate", "image-tools-generate", "kids-drawing-to-art"], limits: "20/day" }),
  op({ id: "video.generate", section: "mediaStudio", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "fixed", localFallback: false, edge: ["video-studio"], limits: "5/day; provider key unset today" }),
  op({ id: "vision.analyse", section: "assistant", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "fixed", localFallback: false, edge: ["analyze-image", "radar-ai", "ocr-scan", "analyze-meal"], limits: "20/day each" }),
  op({ id: "whatsapp.ai", section: null, cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "shadow", localFallback: true, edge: ["whatsapp-webhook", "meta-messaging-webhook"], limits: "daily operations per plan; trial is held silently after one notice" }),
  op({ id: "kids.ai", section: "kids", cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["kids-ai-teacher", "kids-story-generate"], limits: "per-user daily limits" }),
  op({ id: "voice.rooms", section: "messages", cls: "R", requiresAuth: true, trialAllowed: false, paidProvider: false, needsPaidPlan: false, vx: "none", localFallback: false, edge: ["livekit-token"], limits: "NOT enforced on the server: any signed-in account can mint a room token" }),
] as const;

export function operationById(id: string): OperationPolicy | undefined {
  return OPERATIONS.find((o) => o.id === id);
}

// ── The decision ────────────────────────────────────────────────────────────

export type Reason =
  | "sign_in"
  | "trial_excluded"
  | "plan_required"
  | "plan_not_included"
  | "insufficient_vx"
  | "unavailable"
  | "review";

/** Translation keys, one per outcome. Every one exists in all twenty locales. */
export const ACCESS_MESSAGE_KEYS = {
  sign_in: "access.signInRequired",
  trial_excluded: "subscriptionGate.trialMessage",
  plan_required: "subscriptionGate.message",
  plan_not_included: "access.planNotIncluded",
  insufficient_vx: "access.insufficientVx",
  unavailable: "access.unavailable",
  review: "access.unavailable",
  saved: "access.savedAnswer",
  trial_local: "access.trialLocal",
} as const;

export interface Caller {
  signedIn: boolean;
  /** `plan_for_user`'s answer: a paid plan id, "free_trial", "none" or "admin". */
  plan: string;
  /** Spendable VX, when known. */
  vxBalance?: number;
}

export interface Situation {
  /** A stored answer or file exists for this request. */
  savedAvailable?: boolean;
  /** The provider is up and priced. `false` means no call may be made. */
  providerAvailable?: boolean;
  /** VX the operation would hold, when it is charged. */
  vxCost?: number;
}

export type Decision =
  | { allow: true; source: "internal" | "saved" | "provider"; messageKey?: string; providerCalled: boolean }
  | { allow: false; reason: Reason; messageKey: string; providerCalled: false };

const deny = (reason: Reason): Decision =>
  ({ allow: false, reason, messageKey: ACCESS_MESSAGE_KEYS[reason], providerCalled: false });

export function isEntitledPlan(plan: string): boolean {
  return plan === "admin" || (PAID_PLAN_ORDER as readonly string[]).includes(plan);
}

/**
 * The order is the policy: identity, then the section, then a stored answer,
 * then the plan, then VX, then availability. A provider is reached only by
 * falling all the way through, and a stored answer never reaches one.
 */
export function decideAccess(operation: OperationPolicy | undefined, caller: Caller, situation: Situation = {}): Decision {
  if (!operation || operation.cls === "R") return deny("review");
  if (operation.requiresAuth && !caller.signedIn) return deny("sign_in");

  const admin = caller.plan === "admin";
  if (operation.section && !admin) {
    const opens = caller.plan === "free_trial"
      ? TRIAL_SECTIONS.includes(operation.section)
      : planAllows(caller.plan, operation.section);
    if (!opens) return deny(caller.plan === "free_trial" ? "trial_excluded" : "plan_not_included");
  }

  if (operation.localFallback && situation.savedAvailable) {
    return { allow: true, source: "saved", messageKey: ACCESS_MESSAGE_KEYS.saved, providerCalled: false };
  }

  if (operation.needsPaidPlan && !isEntitledPlan(caller.plan)) {
    return deny(caller.plan === "free_trial" ? "trial_excluded" : "plan_required");
  }

  if (operation.vx === "fixed" || operation.vx === "metered") {
    const cost = situation.vxCost ?? 0;
    if (caller.vxBalance === undefined || caller.vxBalance < cost) return deny("insufficient_vx");
  }

  if (operation.paidProvider) {
    if (situation.providerAvailable === false) return deny("unavailable");
    return { allow: true, source: "provider", providerCalled: true };
  }

  return {
    allow: true,
    source: "internal",
    messageKey: caller.plan === "free_trial" && operation.cls === "A" ? ACCESS_MESSAGE_KEYS.trial_local : undefined,
    providerCalled: false,
  };
}

/** The operation a route belongs to is its section; used by screens that only know the path. */
export function sectionOfPath(pathname: string): SectionKey | null {
  return sectionForPath(pathname);
}
