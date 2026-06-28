// Voice Studio — service layer (pure async, no React)
import { supabase } from "@/integrations/supabase/client";
import type {
  VoiceProfile,
  VoiceDataset,
  TrainingJob,
  TrainingLog,
  VoiceProfileFilters,
  CreateVoiceProfileInput,
  UpdateVoiceProfileInput,
  DatasetStatus,
} from "@/lib/types/voice-studio";

const db = supabase as any;

// ── Voice Profiles ────────────────────────────────────────────────────────────

export async function listProfiles(filters: VoiceProfileFilters = {}): Promise<VoiceProfile[]> {
  let q = db.from("vs_voice_profiles").select("*");

  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  } else {
    // default: hide archived
    if (!filters.status) q = q.neq("status", "archived");
  }

  if (filters.gender && filters.gender !== "all") q = q.eq("gender", filters.gender);
  if (filters.language)  q = q.eq("language", filters.language);
  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.showFavoritesOnly) q = q.eq("is_favorite", true);

  const sortBy  = filters.sortBy  ?? "created_at";
  const sortDir = filters.sortDir ?? "desc";
  q = q.order(sortBy, { ascending: sortDir === "asc" });

  const { data, error } = await q;
  if (error) throw error;

  let result: VoiceProfile[] = data ?? [];

  if (filters.query?.trim()) {
    const q2 = filters.query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q2) ||
        p.description?.toLowerCase().includes(q2) ||
        p.tags.some((t: string) => t.includes(q2))
    );
  }

  return result;
}

export async function getProfile(id: string): Promise<VoiceProfile | null> {
  const { data, error } = await db
    .from("vs_voice_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(input: CreateVoiceProfileInput): Promise<VoiceProfile> {
  const { data, error } = await db
    .from("vs_voice_profiles")
    .insert({
      name:        input.name,
      description: input.description ?? null,
      language:    input.language ?? "en",
      accent:      input.accent ?? null,
      gender:      input.gender ?? null,
      tags:        input.tags ?? [],
      project_id:  input.project_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id: string, input: UpdateVoiceProfileInput): Promise<VoiceProfile> {
  const { data, error } = await db
    .from("vs_voice_profiles")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveProfile(id: string): Promise<void> {
  const { error } = await db
    .from("vs_voice_profiles")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreProfile(id: string): Promise<void> {
  const { error } = await db
    .from("vs_voice_profiles")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleFavoriteProfile(id: string, current: boolean): Promise<void> {
  const { error } = await db
    .from("vs_voice_profiles")
    .update({ is_favorite: !current, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateProfile(id: string): Promise<VoiceProfile> {
  const { data: src, error } = await db
    .from("vs_voice_profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return createProfile({
    name:        `${src.name} (copy)`,
    description: src.description,
    language:    src.language,
    accent:      src.accent,
    gender:      src.gender,
    tags:        src.tags,
    project_id:  src.project_id,
  });
}

// ── Voice Datasets ────────────────────────────────────────────────────────────

export async function listDatasets(profileId: string): Promise<VoiceDataset[]> {
  const { data, error } = await db
    .from("vs_voice_datasets")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createDatasetRecord(
  profileId: string,
  filename: string,
  storagePath: string,
  mimeType: string,
  fileSizeBytes: number,
  analysis?: {
    duration_sec?: number;
    sample_rate?: number;
    channels?: number;
    quality_score?: number;
    noise_level?: number;
    clarity_score?: number;
    snr_db?: number;
    is_valid?: boolean;
  }
): Promise<VoiceDataset> {
  const status: DatasetStatus = analysis?.is_valid === false ? "rejected" : "uploaded";
  const { data, error } = await db
    .from("vs_voice_datasets")
    .insert({
      profile_id:     profileId,
      filename,
      storage_path:   storagePath,
      mime_type:      mimeType,
      file_size_bytes: fileSizeBytes,
      status,
      ...(analysis ?? {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDatasetStatus(
  id: string,
  status: DatasetStatus,
  rejection_reason?: string
): Promise<void> {
  const { error } = await db
    .from("vs_voice_datasets")
    .update({ status, ...(rejection_reason ? { rejection_reason } : {}) })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDataset(id: string, storagePath: string): Promise<void> {
  // Delete from storage first
  await (supabase as any).storage.from("voice-datasets").remove([storagePath]);
  // Delete DB record
  const { error } = await db.from("vs_voice_datasets").delete().eq("id", id);
  if (error) throw error;
}

export async function syncProfileStats(profileId: string): Promise<void> {
  await db.rpc("vs_sync_profile_stats", { p_profile_id: profileId });
}

// ── Upload to Supabase Storage ────────────────────────────────────────────────

export async function uploadDatasetFile(
  userId: string,
  profileId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const ext       = file.name.split(".").pop() ?? "wav";
  const fileName  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path      = `${userId}/${profileId}/${fileName}`;

  // Supabase JS v2 doesn't expose upload progress natively, simulate via xhr
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const url = `${supabaseUrl}/storage/v1/object/voice-datasets/${path}`;

      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token ?? anonKey}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("x-upsert", "false");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(path);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  });
}

// ── Training Jobs ─────────────────────────────────────────────────────────────

export async function getLatestTrainingJob(profileId: string): Promise<TrainingJob | null> {
  const { data, error } = await db
    .from("vs_training_jobs")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTrainingLogs(jobId: string): Promise<TrainingLog[]> {
  const { data, error } = await db
    .from("vs_training_logs")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
