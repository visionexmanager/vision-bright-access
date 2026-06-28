// Speech Studio — TypeScript types

export type SpeechJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type OutputFormat = "mp3" | "wav" | "flac" | "opus" | "aac";
export type SpeechModel = "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";
export type VoiceGender = "male" | "female" | "neutral";
export type VoiceCategory = "general" | "education" | "creative" | "news" | "media" | "tech" | "wellness" | "assistant";

export interface SpeechVoice {
  id: string;                         // e.g. "openai-alloy"
  name: string;
  provider: string;
  provider_voice_id: string;          // sent to provider API
  gender: VoiceGender | null;
  age_style: string | null;
  accent: string | null;
  language: string;
  supported_languages: string[];
  description: string | null;
  tags: string[];
  category: VoiceCategory;
  is_premium: boolean;
  sample_url: string | null;
  requires_model: string | null;
  sort_order: number;
  created_at: string;
  // Client-side computed
  is_favorite?: boolean;
  is_recent?: boolean;
  recent_use_count?: number;
}

export interface SpeechPreset {
  id: string;
  user_id: string;
  name: string;
  voice_id: string;
  language: string;
  emotion: SpeechEmotion;
  speed: number;
  pitch: number;
  output_format: OutputFormat;
  model: SpeechModel;
  provider: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpeechJob {
  id: string;
  user_id: string;
  project_id: string | null;
  asset_id: string | null;
  input_text: string;
  voice_id: string;
  voice_name: string | null;
  language: string;
  emotion: string;
  speed: number;
  pitch: number;
  output_format: string;
  model: string;
  provider: string;
  preset_id: string | null;
  preset_name: string | null;
  public_url: string | null;
  storage_path: string | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
  status: SpeechJobStatus;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ── Emotions ──────────────────────────────────────────────────────────────────

export type SpeechEmotion =
  | "neutral"
  | "happy"
  | "sad"
  | "excited"
  | "calm"
  | "serious"
  | "warm"
  | "energetic";

export interface EmotionOption {
  value: SpeechEmotion;
  label: string;
  emoji: string;
  description: string;
}

export const SPEECH_EMOTIONS: EmotionOption[] = [
  { value: "neutral",   label: "Neutral",    emoji: "😐", description: "Balanced, objective delivery" },
  { value: "happy",     label: "Happy",      emoji: "😊", description: "Warm, upbeat, positive tone" },
  { value: "excited",   label: "Excited",    emoji: "🎉", description: "Energetic, enthusiastic delivery" },
  { value: "calm",      label: "Calm",       emoji: "😌", description: "Relaxed, peaceful, measured" },
  { value: "serious",   label: "Serious",    emoji: "🧐", description: "Authoritative, professional, precise" },
  { value: "warm",      label: "Warm",       emoji: "🤗", description: "Friendly, inviting, caring" },
  { value: "sad",       label: "Sad",        emoji: "😢", description: "Empathetic, gentle, subdued" },
  { value: "energetic", label: "Energetic",  emoji: "⚡", description: "Dynamic, punchy, motivating" },
];

// ── Languages ─────────────────────────────────────────────────────────────────

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SPEECH_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English",    nativeLabel: "English",    flag: "🇺🇸" },
  { code: "ar", label: "Arabic",     nativeLabel: "العربية",    flag: "🇸🇦" },
  { code: "es", label: "Spanish",    nativeLabel: "Español",    flag: "🇪🇸" },
  { code: "fr", label: "French",     nativeLabel: "Français",   flag: "🇫🇷" },
  { code: "de", label: "German",     nativeLabel: "Deutsch",    flag: "🇩🇪" },
  { code: "zh", label: "Chinese",    nativeLabel: "中文",        flag: "🇨🇳" },
  { code: "hi", label: "Hindi",      nativeLabel: "हिंदी",       flag: "🇮🇳" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português",  flag: "🇧🇷" },
  { code: "ru", label: "Russian",    nativeLabel: "Русский",    flag: "🇷🇺" },
  { code: "tr", label: "Turkish",    nativeLabel: "Türkçe",     flag: "🇹🇷" },
  { code: "ur", label: "Urdu",       nativeLabel: "اردو",       flag: "🇵🇰" },
  { code: "ja", label: "Japanese",   nativeLabel: "日本語",      flag: "🇯🇵" },
  { code: "ko", label: "Korean",     nativeLabel: "한국어",      flag: "🇰🇷" },
  { code: "it", label: "Italian",    nativeLabel: "Italiano",   flag: "🇮🇹" },
  { code: "nl", label: "Dutch",      nativeLabel: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polish",     nativeLabel: "Polski",     flag: "🇵🇱" },
];

// ── Voice Filters ─────────────────────────────────────────────────────────────

export interface VoiceFilters {
  query?: string;
  gender?: VoiceGender | "all";
  category?: VoiceCategory | "all";
  language?: string;
  showFavoritesOnly?: boolean;
}

// ── Generation State ──────────────────────────────────────────────────────────

export type GenerationStep = "idle" | "queued" | "processing" | "finalizing" | "completed" | "failed";

export interface GeneratedAudio {
  jobId: string;
  assetId: string | null;
  blobUrl: string;          // browser-side Blob URL for playback
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  outputFormat: OutputFormat;
  voiceId: string;
  voiceName: string;
  text: string;
  createdAt: string;
}

// ── Create DTOs ───────────────────────────────────────────────────────────────

export interface CreatePresetInput {
  name: string;
  voice_id: string;
  language?: string;
  emotion?: SpeechEmotion;
  speed?: number;
  pitch?: number;
  output_format?: OutputFormat;
  model?: SpeechModel;
  provider?: string;
}

export interface UpdatePresetInput extends Partial<CreatePresetInput> {
  is_favorite?: boolean;
}
