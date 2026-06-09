/**
 * Services barrel — import all service layers from one place.
 *
 * Usage:
 *   import { aiService } from "@/services"
 *   import { createVoiceSession } from "@/services"
 */
export { aiService } from "./ai/aiService";
export type { ChatMessage, ChatContext } from "./ai/aiService";

export { createVoiceSession } from "./voice/voiceService";
export type { VoiceSession, VoiceSessionStatus, VoiceSessionCallbacks } from "./voice/voiceService";

export * from "./academy/academyService";
