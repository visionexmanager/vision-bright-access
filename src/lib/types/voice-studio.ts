// Voice Studio — TypeScript types

export type VoiceProfileStatus   = "draft" | "training" | "completed" | "failed" | "archived";
export type TrainingStatus       = "not_started" | "uploading" | "validating" | "queued" | "training" | "optimizing" | "completed" | "failed" | "cancelled";
export type DatasetStatus        = "pending" | "uploaded" | "analyzing" | "accepted" | "rejected";
export type TrainingJobStatus    = "queued" | "uploading" | "validating" | "training" | "optimizing" | "completed" | "failed" | "cancelled";
export type TrainingLogLevel     = "info" | "warning" | "error" | "success";

export type VoiceGenderOpt = "male" | "female" | "neutral";

// ── Voice Profile ─────────────────────────────────────────────────────────────

export interface VoiceProfile {
  id:                   string;
  user_id:              string;
  project_id:           string | null;
  name:                 string;
  description:          string | null;
  language:             string;
  accent:               string | null;
  gender:               VoiceGenderOpt | null;
  tags:                 string[];
  status:               VoiceProfileStatus;
  training_status:      TrainingStatus;
  provider:             string;
  provider_voice_id:    string | null;
  provider_model:       string | null;
  quality_score:        number | null;
  total_duration_sec:   number;
  sample_count:         number;
  preview_asset_id:     string | null;
  thumbnail_url:        string | null;
  is_favorite:          boolean;
  is_shared:            boolean;
  created_at:           string;
  updated_at:           string;
}

// ── Voice Dataset ─────────────────────────────────────────────────────────────

export interface VoiceDataset {
  id:             string;
  profile_id:     string;
  user_id:        string;
  filename:       string;
  storage_path:   string;
  mime_type:      string;
  file_size_bytes: number;
  duration_sec:   number | null;
  sample_rate:    number | null;
  channels:       number | null;
  quality_score:  number | null;
  noise_level:    number | null;
  clarity_score:  number | null;
  snr_db:         number | null;
  is_valid:       boolean | null;
  status:         DatasetStatus;
  rejection_reason: string | null;
  created_at:     string;
}

// ── Training Job ──────────────────────────────────────────────────────────────

export interface TrainingJob {
  id:               string;
  profile_id:       string;
  user_id:          string;
  status:           TrainingJobStatus;
  progress:         number;
  provider:         string;
  provider_job_id:  string | null;
  provider_voice_id: string | null;
  error_message:    string | null;
  error_code:       string | null;
  retry_count:      number;
  created_at:       string;
  started_at:       string | null;
  completed_at:     string | null;
  estimated_duration_sec: number | null;
}

// ── Training Log ──────────────────────────────────────────────────────────────

export interface TrainingLog {
  id:         string;
  job_id:     string;
  user_id:    string;
  level:      TrainingLogLevel;
  message:    string;
  metadata:   Record<string, unknown>;
  created_at: string;
}

// ── Upload Item (client-side) ─────────────────────────────────────────────────

export type UploadItemStatus = "pending" | "analyzing" | "uploading" | "done" | "error" | "cancelled";

export interface VoiceUploadItem {
  id:          string;     // crypto.randomUUID()
  file:        File;
  profileId:   string;
  status:      UploadItemStatus;
  progress:    number;     // 0-100
  error?:      string;
  // Client-side analysis result
  analysis?:   AudioAnalysisResult;
  // DB record once uploaded
  datasetId?:  string;
}

// ── Audio Analysis (client-side Web Audio API) ────────────────────────────────

export interface AudioAnalysisResult {
  durationSec:     number;
  sampleRate:      number;
  channels:        number;
  estimatedSnrDb:  number;  // rough SNR
  noiseLevel:      number;  // 0-10
  clarityScore:    number;  // 0-10
  qualityScore:    number;  // 0-10
  isValid:         boolean;
  issues:          string[];
  suggestions:     string[];
}

// ── Filters ───────────────────────────────────────────────────────────────────

export interface VoiceProfileFilters {
  query?:         string;
  status?:        VoiceProfileStatus | "all";
  gender?:        VoiceGenderOpt | "all";
  language?:      string;
  projectId?:     string;
  showFavoritesOnly?: boolean;
  sortBy?:        "name" | "created_at" | "updated_at" | "quality_score";
  sortDir?:       "asc" | "desc";
}

// ── Create DTOs ───────────────────────────────────────────────────────────────

export interface CreateVoiceProfileInput {
  name:         string;
  description?: string;
  language?:    string;
  accent?:      string;
  gender?:      VoiceGenderOpt;
  tags?:        string[];
  project_id?:  string;
}

export interface UpdateVoiceProfileInput extends Partial<CreateVoiceProfileInput> {
  is_favorite?: boolean;
  status?:      VoiceProfileStatus;
}

// ── Training Pipeline Steps ───────────────────────────────────────────────────

export interface TrainingStep {
  key:       TrainingJobStatus;
  label:     string;
  sublabel:  string;
  progress:  number;  // expected progress at this step
}

export const TRAINING_STEPS: TrainingStep[] = [
  { key: "queued",     label: "Queued",      sublabel: "Waiting to start…",              progress: 5  },
  { key: "uploading",  label: "Uploading",   sublabel: "Sending samples to provider…",   progress: 20 },
  { key: "validating", label: "Validating",  sublabel: "Analyzing audio quality…",       progress: 40 },
  { key: "training",   label: "Training",    sublabel: "Training voice model…",          progress: 65 },
  { key: "optimizing", label: "Optimizing",  sublabel: "Finalizing voice profile…",      progress: 90 },
  { key: "completed",  label: "Completed",   sublabel: "Your voice is ready!",           progress: 100 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

export const DATASET_CONSTRAINTS = {
  MIN_DURATION_SEC:    5,
  MAX_DURATION_SEC:    300,
  MAX_FILE_SIZE_BYTES: 52_428_800,   // 50 MB
  MIN_TOTAL_SEC:       30,           // minimum total recording for training
  RECOMMENDED_SEC:     120,
  MAX_FILES:           25,
  ACCEPTED_FORMATS:    ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/flac", "audio/x-flac"],
  ACCEPTED_EXTENSIONS: [".wav", ".mp3", ".flac"],
} as const;
