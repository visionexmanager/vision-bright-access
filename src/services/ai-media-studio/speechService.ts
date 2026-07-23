// Speech Studio — service layer (pure async, no React)
import { supabase } from "@/integrations/supabase/client";
import type {
  SpeechVoice,
  SpeechPreset,
  SpeechJob,
  VoiceFilters,
  CreatePresetInput,
  UpdatePresetInput,
} from "@/lib/types/speech-studio";

const db = supabase as any;

async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

// ── Voices ────────────────────────────────────────────────────────────────────

export async function listVoices(): Promise<SpeechVoice[]> {
  const { data, error } = await db
    .from("ams_voices")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getVoice(id: string): Promise<SpeechVoice | null> {
  const { data, error } = await db
    .from("ams_voices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Voice Favorites ───────────────────────────────────────────────────────────

export async function listFavoriteVoiceIds(): Promise<string[]> {
  const { data, error } = await db
    .from("ams_voice_favorites")
    .select("voice_id");
  if (error) throw error;
  return (data ?? []).map((r: { voice_id: string }) => r.voice_id);
}

export async function addVoiceFavorite(voiceId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await db
    .from("ams_voice_favorites")
    .insert({ user_id: userId, voice_id: voiceId });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function removeVoiceFavorite(voiceId: string): Promise<void> {
  const { error } = await db
    .from("ams_voice_favorites")
    .delete()
    .eq("voice_id", voiceId);
  if (error) throw error;
}

// ── Voice Recent ──────────────────────────────────────────────────────────────

export async function listRecentVoices(): Promise<{ voice_id: string; use_count: number; used_at: string }[]> {
  const { data, error } = await db
    .from("ams_voice_recent")
    .select("voice_id, use_count, used_at")
    .order("used_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return data ?? [];
}

// ── Voice filtering helper (client-side) ──────────────────────────────────────

export function filterVoices(voices: SpeechVoice[], filters: VoiceFilters): SpeechVoice[] {
  let result = [...voices];

  if (filters.showFavoritesOnly) {
    result = result.filter((v) => v.is_favorite);
  }

  if (filters.gender && filters.gender !== "all") {
    result = result.filter((v) => v.gender === filters.gender);
  }

  if (filters.category && filters.category !== "all") {
    result = result.filter((v) => v.category === filters.category);
  }

  if (filters.language) {
    result = result.filter(
      (v) =>
        v.language === filters.language ||
        v.supported_languages.includes(filters.language!)
    );
  }

  if (filters.query?.trim()) {
    const q = filters.query.toLowerCase();
    result = result.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.tags.some((t) => t.includes(q)) ||
        v.accent?.toLowerCase().includes(q)
    );
  }

  return result;
}

// ── Presets ───────────────────────────────────────────────────────────────────

export async function listPresets(): Promise<SpeechPreset[]> {
  const { data, error } = await db
    .from("ams_speech_presets")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPreset(input: CreatePresetInput): Promise<SpeechPreset> {
  const userId = await requireUserId();
  const { data, error } = await db
    .from("ams_speech_presets")
    .insert({
      user_id:       userId,
      name:          input.name,
      voice_id:      input.voice_id,
      language:      input.language ?? "en",
      emotion:       input.emotion ?? "neutral",
      speed:         input.speed ?? 1.0,
      pitch:         input.pitch ?? 0,
      output_format: input.output_format ?? "mp3",
      model:         input.model ?? "tts-1",
      provider:      input.provider ?? "openai",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePreset(id: string, input: UpdatePresetInput): Promise<SpeechPreset> {
  const { data, error } = await db
    .from("ams_speech_presets")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await db.from("ams_speech_presets").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicatePreset(id: string): Promise<SpeechPreset> {
  const preset = await db
    .from("ams_speech_presets")
    .select("*")
    .eq("id", id)
    .single();
  if (preset.error) throw preset.error;
  const src = preset.data as SpeechPreset;
  return createPreset({
    name:          `${src.name} (copy)`,
    voice_id:      src.voice_id,
    language:      src.language,
    emotion:       src.emotion,
    speed:         src.speed,
    pitch:         src.pitch,
    output_format: src.output_format as any,
    model:         src.model as any,
    provider:      src.provider,
  });
}

// ── History (jobs) ────────────────────────────────────────────────────────────

export async function listHistory(limit = 20, offset = 0): Promise<SpeechJob[]> {
  const { data, error } = await db
    .from("ams_speech_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export async function getJob(id: string): Promise<SpeechJob | null> {
  const { data, error } = await db
    .from("ams_speech_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await db.from("ams_speech_jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function cancelJob(id: string): Promise<void> {
  const { error } = await db
    .from("ams_speech_jobs")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["queued", "processing"]);
  if (error) throw error;
}
