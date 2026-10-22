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
  | "paid_plan"     // hasActivePaidPlan: a paying account or an admin, for billed non-AI services
  | "claim"         // an atomic per-caller limit and ledger decided in the database before anything is sent (bazaar_notify_claim)
  | "token"         // an unguessable, short-lived capability token minted elsewhere for a signed-in account, re-checked on use
  | "unverified";   // not proven: none remain after the 2026-10-21 audit (a test pins that)

export interface EdgePolicy {
  cls: AccessClass;
  guard: Guard;
  /** May an account that is only inside its free week call it? */
  trial: boolean;
  note: string;
  /** Not fully resolved: identity is proven but a limit or cost is not. Listed in the report; a test pins the set. */
  open?: true;
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
  "bazaar-checkout": { cls: "C", guard: "jwt", trial: false, note: "Marketplace checkout; identity from the verified session (getUser), no user id taken from the body." },
  "bazaar-notify-seller": { cls: "D", guard: "claim", trial: false, note: "Sends an in-app notification, an e-mail (Resend) and a WhatsApp message to a seller, so it is treated as billed. Platform calls (service role) are unlimited; a user's are authorised per event (order_paid only for their own paid order from the last 30 minutes at that shop, order_status and low_stock refused) and claimed through bazaar_notify_claim: 10-minute duplicate window (24 hours for an event naming an order), 5 per shop per hour, 30 per day, and e-mail/WhatsApp for at most 20 per shop per hour across all senders. Fails closed." },
  "bazaar-stripe-connect": { cls: "C", guard: "jwt", trial: false, note: "Seller onboarding with Stripe Connect; verified session, own account." },
  "bazaar-stripe-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "billing-engine": { cls: "C", guard: "jwt", trial: false, note: "Subscription/VX actions for the caller; admin actions check has_role inside the function." },
  "career-ai": { cls: "D", guard: "ai_gate", trial: false, note: "Career AI; gated through its shared handler (handleStructuredCareerAiRequest)." },
  "career-billing-checkout": { cls: "C", guard: "jwt", trial: false, note: "Career plan checkout; verified session, own account." },
  "career-billing-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "career-gdpr-request": { cls: "C", guard: "jwt", trial: false, note: "Data-protection request for the caller; verified session." },
  "career-system-health": { cls: "D", guard: "admin", trial: false, note: "Probes the Gemini key and writes 16 history rows per call. Was callable by anyone holding the public anon key; now requires CRON_SECRET or an admin session, before any probe or write." },
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
  "kids-issue-certificate": { cls: "C", guard: "jwt", trial: false, note: "Issues the caller's own certificate; verified session." },
  "kids-story-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-classify-book": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-search": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-ai-writing-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-book-analytics": { cls: "B", guard: "jwt", trial: false, note: "Book analytics for a book's owner or an admin; verified session plus role check." },
  "library-build-knowledge-graph": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-checkout-session": { cls: "C", guard: "jwt", trial: false, note: "Library purchase/donation checkout; verified session." },
  "library-crypto-checkout": { cls: "C", guard: "jwt", trial: false, note: "Library crypto checkout; verified session." },
  "library-crypto-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-detect-series": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-embed-book": { cls: "D", guard: "ai_gate", trial: false, note: "Gated; produces or indexes content with a provider or heavy compute." },
  "library-generate-flashcard-deck": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-narration": { cls: "D", guard: "ai_gate", trial: false, note: "Gated; produces or indexes content with a provider or heavy compute." },
  "library-generate-practice-exam": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-quotes": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-generate-reading-plan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-import-book": { cls: "B", guard: "jwt", trial: false, note: "Import for the caller's own author record, or an admin (public-domain imports admin-only); verified session." },
  "library-issue-certificate": { cls: "C", guard: "jwt", trial: false, note: "Issues the caller's own certificate; verified session." },
  "library-librarian-chat": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-librarian-daily-plan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-librarian-privacy": { cls: "C", guard: "jwt", trial: false, note: "The caller's own librarian data requests; verified session." },
  "library-librarian-recommendations": { cls: "B", guard: "jwt", trial: true, note: "Database-only recommendations; per-user daily limit, no provider." },
  "library-librarian-summary": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-paypal-checkout": { cls: "C", guard: "jwt", trial: false, note: "Library PayPal checkout; verified session." },
  "library-paypal-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-process-background-jobs": { cls: "D", guard: "cron", trial: false, note: "Scheduled (CRON_SECRET); processes queued jobs." },
  "library-purchase-book": { cls: "C", guard: "jwt", trial: false, note: "Purchase of a book for the caller; verified session." },
  "library-recommend-books": { cls: "B", guard: "jwt", trial: true, note: "Database-only recommendations." },
  "library-recommend-community": { cls: "B", guard: "jwt", trial: true, note: "Database-only recommendations for the caller; verified session." },
  "library-research-assistant": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-reward-vx": { cls: "C", guard: "jwt", trial: false, note: "Awards through award_library_xp with the caller's own session, bounded by the shared 2,000 VX/day self-award allowance." },
  "library-semantic-search": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-stripe-webhook": { cls: "C", guard: "signature", trial: false, note: "Payment webhook; verified by provider signature, not a user session." },
  "library-summarize-discussion": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-sync-progress": { cls: "C", guard: "jwt", trial: true, note: "The caller's own reading progress, favourites, shelves; verified session, row-level security." },
  "library-track-reading": { cls: "C", guard: "jwt", trial: true, note: "The caller's own reading progress; verified session, row-level security." },
  "library-translate-book-metadata": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "library-translate-comment": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "livekit-token": { cls: "D", guard: "paid_plan", trial: false, note: "LiveKit rooms are billed per participant-minute by the host (billing not verified). Requires an active paid plan or admin before the body is parsed; signs a token only for a room that exists, is active (admins excepted) and the caller is not banned from (adult UUID or 'kids-<uuid>'); the name is the account's display name, never an e-mail; the token is room-join only for the verified user id, two hours. Then voice_room_join (migration 20261085) decides the room password (hashed, throttled), the capacity (recent heartbeats) and the one-time join price under a lock on the room row, and records the membership; owners and admins pass. Not enforced: whether a member may publish (listener/stage is a page setting), a minute cap, and the fee to create a room. Fails closed.", },
  "meta-messaging-webhook": { cls: "D", guard: "webhook_gate", trial: false, note: "Messenger/Instagram webhook; AI answers need an active plan." },
  "mobility": { cls: "C", guard: "jwt", trial: false, note: "Requires a verified session (401 otherwise). Every provider adapter declares shape 'none', so no provider is callable today and no paid call can be made; a future adapter must add a plan gate before it is enabled." },
  "moderate-content": { cls: "B", guard: "jwt", trial: true, note: "Calls the free OpenAI moderation endpoint (no charge); signed-in only. Deliberately outside the subscription gate so child safety checks keep working." },
  "news-generate": { cls: "D", guard: "cron", trial: false, note: "Scheduled (CRON_SECRET) or admin; never a user request." },
  "newsletter-preferences": { cls: "C", guard: "token", trial: true, note: "Public by design: acts only on the subscriber whose unguessable manage token (UUID, 128 bits) is presented; reads and edits that one row." },
  "ocr-scan": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "organization-ai-admin": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "owner-control": { cls: "D", guard: "owner", trial: false, note: "Owner/admin console, can run AI." },
  "provider-hub": { cls: "D", guard: "admin", trial: false, note: "Admin or CRON_SECRET; provider registry and model discovery." },
  "radar-ai": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "radio-stream-token": { cls: "B", guard: "token", trial: false, note: "Redeems a 64-character short-lived token minted for a signed-in account; expiry and the radio subscription are re-checked on use. No token, no stream URL." },
  "realtime-session": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "send-email": { cls: "C", guard: "jwt", trial: false, note: "Sends e-mail through the mail provider; signed-in only." },
  "social-oauth": { cls: "C", guard: "jwt", trial: false, note: "Owner social-account connection; verified session plus an admin role check." },
  "social-publish": { cls: "D", guard: "cron", trial: false, note: "Scheduled publishing (CRON_SECRET) and owner actions; uses AI for captions and images." },
  "speech-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "speech-transcribe": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "text-to-speech": { cls: "D", guard: "voice_guard", trial: false, note: "Voice request guard: identity, plan, limit, then provider." },
  "text-tools-generate": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "trial-billing": { cls: "C", guard: "cron", trial: false, note: "Scheduled trial reminders and expiry e-mails." },
  "tv-stream-token": { cls: "B", guard: "token", trial: false, note: "Redeems a 64-character short-lived token minted for a signed-in account; expiry and the TV subscription are re-checked on use. No token, no stream URL." },
  "tv-validate-stream": { cls: "B", guard: "cron", trial: false, note: "Scheduled stream-availability probe; requires CRON_SECRET." },
  "video-studio": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "voice-studio": { cls: "D", guard: "ai_gate", trial: false, note: "Subscription gate runs before the provider call." },
  "vx-coin-review": { cls: "C", guard: "jwt", trial: false, note: "Admin approval of VX top-ups; the RPCs check has_role(admin) themselves, the function only sends the buyer e-mail." },
  "whatsapp-webhook": { cls: "D", guard: "webhook_gate", trial: false, note: "WhatsApp webhook; AI answers need an active plan. A linked free-week sender is never sent the subscription notice; any other unentitled sender gets one notice and at most six re-notices a day, within an optional database-wide hourly budget (ops_limits, off by default). The notice fails closed. Local menus/audio for the trial are NOT served: the gate stays silent for them." },
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
  op({ id: "voice.rooms", section: null, cls: "D", requiresAuth: true, trialAllowed: false, paidProvider: true, needsPaidPlan: true, vx: "none", localFallback: false, edge: ["livekit-token"], limits: "paid plan or admin only; password, capacity and join price enforced by the server (voice_room_join); LiveKit billing exposure and minute limits not yet verified, so no trial access" }),
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

// ── Section-level entitlement of AI functions ───────────────────────────────

/**
 * AI functions that belong to ONE section of the product, and the section a plan must include.
 * `ai_subscription_gate` proves a paying account; the function then asks `user_has_section` for this
 * section (`requireSection` / `maySeeSection` in `_shared/entitlements.ts`), on the server, so a
 * plan that does not include the section cannot reach the provider by calling the function directly.
 * Verified in source and by `access-policy.test.ts`; the plan/section truth is `plans.ts`.
 */
export const AI_FUNCTION_SECTIONS: Readonly<Record<string, SectionKey>> = {
  "library-ai-writing-assistant": "studio",
  "library-ai-classify-book": "studio",
  "library-detect-series": "studio",
  "library-build-knowledge-graph": "studio",
  "library-translate-book-metadata": "studio",
  "library-generate-narration": "studio",
  "library-generate-quotes": "library",
  "academy-chat": "academy",
  "career-ai": "career",
  "document-generate": "mediaStudio",
  "file-convert": "professional",
  "image-generate": "mediaStudio",
  "image-tools-generate": "mediaStudio",
  "kids-ai-teacher": "kids",
  "kids-drawing-to-art": "kids",
  "kids-story-generate": "kids",
  "library-ai-assistant": "library",
  "library-ai-chat": "library",
  "library-ai-search": "library",
  "library-generate-flashcard-deck": "library",
  "library-generate-practice-exam": "library",
  "library-generate-reading-plan": "library",
  "library-librarian-chat": "library",
  "library-librarian-daily-plan": "library",
  "library-librarian-summary": "library",
  "library-research-assistant": "library",
  "library-semantic-search": "library",
  "library-summarize-discussion": "library",
  "library-translate-comment": "library",
  "speech-generate": "mediaStudio",
  "text-tools-generate": "mediaStudio",
  "video-studio": "mediaStudio",
  "voice-studio": "mediaStudio",
};

/**
 * AI functions behind the subscription gate only (any paying plan passes), and why no single section
 * owns them. Adding a section check to one of these is a PRODUCT decision: it would remove direct-call
 * access that some plans have today. The list is pinned by a test so it can shrink and never grow.
 */
export const AI_FUNCTIONS_WITHOUT_SECTION: Readonly<Record<string, string>> = {
  "ai-chat": "The general assistant, used by several sections (assistant, Academy IVX, the domain assistants). No single owner.",
  "ai-generate": "General structured generation used across sections.",
  "ai-search": "General AI search used across sections.",
  "ai-voice-chat": "Voice assistant used across sections.",
  "text-to-speech": "Read-aloud and voice features used across sections.",
  "speech-transcribe": "Dictation used across sections.",
  "realtime-session": "Voice conversation; also capped per month when a plan sets realtime_monthly_minutes (PR #474).",
  "analyze-image": "Image description for assistive use across sections.",
  "radar-ai": "Visual assistant for assistive use across sections.",
  "analyze-meal": "Nutrition service; its section is not modelled in plans.ts.",
  "generate-diet-plan": "Nutrition service; its section is not modelled in plans.ts.",
  "ocr-scan": "Free by design: in no section, and reached from the Library reader; pinned by section-entitlement.test.ts.",
  "organization-ai-admin": "Organisation administration tool; its section is not modelled in plans.ts.",
  "library-embed-book": "Indexing a book for search; section not decided.",
};
