// Video Studio — TypeScript types

export type VideoJobStatus =
  | "queued" | "preparing" | "generating" | "rendering"
  | "optimizing" | "uploading" | "completed" | "failed" | "cancelled";

export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9" | "3:4";
export type VideoResolution  = "480p" | "720p" | "1080p" | "4k";
export type VideoFPS         = 24 | 30 | 60;
export type CameraMotion     =
  | "static" | "pan_left" | "pan_right" | "zoom_in" | "zoom_out"
  | "tilt_up" | "tilt_down" | "orbit" | "dolly_in" | "dolly_out";
export type AudioMode = "none" | "generated" | "uploaded";

// ── Video Job ─────────────────────────────────────────────────────────────────

export interface VideoJob {
  id:                  string;
  user_id:             string;
  project_id:          string | null;
  asset_id:            string | null;
  title:               string | null;
  prompt:              string;
  negative_prompt:     string | null;
  style:               string;
  duration_sec:        number;
  aspect_ratio:        VideoAspectRatio;
  resolution:          VideoResolution;
  fps:                 VideoFPS;
  camera_motion:       CameraMotion;
  creativity:          number;
  seed:                number | null;
  audio_asset_id:      string | null;
  audio_mode:          AudioMode;
  template_id:         string | null;
  provider:            string;
  provider_model:      string | null;
  provider_job_id:     string | null;
  video_url:           string | null;
  storage_path:        string | null;
  thumbnail_url:       string | null;
  thumbnail_path:      string | null;
  duration_actual_sec: number | null;
  file_size_bytes:     number | null;
  width:               number | null;
  height:              number | null;
  status:              VideoJobStatus;
  progress:            number;
  error_message:       string | null;
  retry_count:         number;
  generation_time_ms:  number | null;
  is_favorite:         boolean;
  is_archived:         boolean;
  created_at:          string;
  updated_at:          string;
  started_at:          string | null;
  completed_at:        string | null;
  estimated_complete:  string | null;
}

// ── Video Template ────────────────────────────────────────────────────────────

export interface VideoTemplate {
  id:              string;
  user_id:         string;
  name:            string;
  description:     string | null;
  prompt_template: string;
  negative_prompt: string | null;
  style:           string;
  duration_sec:    number;
  aspect_ratio:    VideoAspectRatio;
  resolution:      VideoResolution;
  fps:             VideoFPS;
  camera_motion:   CameraMotion;
  creativity:      number;
  provider:        string;
  provider_model:  string | null;
  is_favorite:     boolean;
  use_count:       number;
  created_at:      string;
  updated_at:      string;
}

// ── Generation form state ─────────────────────────────────────────────────────

export interface VideoGenerateForm {
  title:           string;
  prompt:          string;
  negativePrompt:  string;
  style:           string;
  durationSec:     number;
  aspectRatio:     VideoAspectRatio;
  resolution:      VideoResolution;
  fps:             VideoFPS;
  cameraMotion:    CameraMotion;
  creativity:      number;
  seed:            string;    // empty = random
  provider:        string;
  providerModel:   string;
  audioMode:       AudioMode;
  audioAssetId:    string;
  projectId:       string;
  templateId:      string;
}

export const DEFAULT_FORM: VideoGenerateForm = {
  title:           "",
  prompt:          "",
  negativePrompt:  "",
  style:           "realistic",
  durationSec:     5,
  aspectRatio:     "16:9",
  resolution:      "720p",
  fps:             24,
  cameraMotion:    "static",
  creativity:      7.0,
  seed:            "",
  provider:        "luma",
  providerModel:   "dream-machine",
  audioMode:       "none",
  audioAssetId:    "",
  projectId:       "",
  templateId:      "",
};

// ── Styles ────────────────────────────────────────────────────────────────────

export interface VideoStyle {
  id:          string;
  label:       string;
  description: string;
  emoji:       string;
  gradient:    string;
  tags:        string[];
}

export const VIDEO_STYLES: VideoStyle[] = [
  { id: "realistic",    label: "Realistic",     description: "Photorealistic footage",       emoji: "📷", gradient: "from-slate-500 to-slate-700",  tags: ["photo","real","natural"] },
  { id: "cinematic",   label: "Cinematic",     description: "Film-quality visuals",          emoji: "🎬", gradient: "from-gray-800 to-gray-950",    tags: ["film","movie","drama"] },
  { id: "animation",   label: "Animation",     description: "Animated 2D/3D style",         emoji: "🎨", gradient: "from-purple-500 to-pink-600",   tags: ["cartoon","2d","animated"] },
  { id: "3d",          label: "3D Render",      description: "3D rendered graphics",          emoji: "🧊", gradient: "from-blue-500 to-cyan-600",    tags: ["cgi","3d","render"] },
  { id: "anime",       label: "Anime",          description: "Japanese animation style",     emoji: "🌸", gradient: "from-rose-400 to-pink-600",    tags: ["japanese","manga","anime"] },
  { id: "fantasy",     label: "Fantasy",        description: "Magical and fantastical",      emoji: "🧙", gradient: "from-violet-500 to-indigo-700", tags: ["magic","fantasy","epic"] },
  { id: "scifi",       label: "Sci-Fi",         description: "Futuristic science fiction",   emoji: "🚀", gradient: "from-sky-500 to-blue-700",     tags: ["future","tech","space"] },
  { id: "nature",      label: "Nature",         description: "Natural landscapes & wildlife",emoji: "🌿", gradient: "from-green-500 to-emerald-700", tags: ["outdoor","nature","wildlife"] },
  { id: "architecture",label: "Architecture",   description: "Buildings & interior design",  emoji: "🏛️", gradient: "from-amber-500 to-orange-600", tags: ["building","interior","design"] },
  { id: "education",   label: "Education",      description: "Explainer & educational",      emoji: "📚", gradient: "from-teal-500 to-cyan-700",    tags: ["explainer","learning","whiteboard"] },
  { id: "marketing",   label: "Marketing",      description: "Brand & product showcase",     emoji: "📢", gradient: "from-orange-500 to-red-600",   tags: ["brand","ads","product"] },
  { id: "social",      label: "Social Media",   description: "Short-form social content",    emoji: "📱", gradient: "from-pink-500 to-rose-600",    tags: ["tiktok","reel","social"] },
  { id: "custom",      label: "Custom",         description: "Your own style prompting",     emoji: "✨", gradient: "from-primary/60 to-primary",   tags: ["custom","freestyle"] },
];

// ── Camera motions ────────────────────────────────────────────────────────────

export interface CameraMotionOption {
  value:   CameraMotion;
  label:   string;
  emoji:   string;
}

export const CAMERA_MOTIONS: CameraMotionOption[] = [
  { value: "static",     label: "Static",       emoji: "⬛" },
  { value: "pan_left",   label: "Pan Left",     emoji: "⬅️" },
  { value: "pan_right",  label: "Pan Right",    emoji: "➡️" },
  { value: "zoom_in",    label: "Zoom In",      emoji: "🔍" },
  { value: "zoom_out",   label: "Zoom Out",     emoji: "🔎" },
  { value: "tilt_up",    label: "Tilt Up",      emoji: "⬆️" },
  { value: "tilt_down",  label: "Tilt Down",    emoji: "⬇️" },
  { value: "orbit",      label: "Orbit",        emoji: "🔄" },
  { value: "dolly_in",   label: "Dolly In",     emoji: "📹" },
  { value: "dolly_out",  label: "Dolly Out",    emoji: "🎥" },
];

// ── Aspect ratio info ─────────────────────────────────────────────────────────

export interface AspectRatioOption {
  value:       VideoAspectRatio;
  label:       string;
  description: string;
  width:       number;
  height:      number;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: "16:9",  label: "16:9",  description: "Landscape / YouTube / TV",  width: 16, height: 9  },
  { value: "9:16",  label: "9:16",  description: "Portrait / TikTok / Reels", width: 9,  height: 16 },
  { value: "1:1",   label: "1:1",   description: "Square / Instagram",        width: 1,  height: 1  },
  { value: "4:3",   label: "4:3",   description: "Classic / Presentation",    width: 4,  height: 3  },
  { value: "21:9",  label: "21:9",  description: "Ultrawide / Cinematic",     width: 21, height: 9  },
  { value: "3:4",   label: "3:4",   description: "Portrait / Pinterest",      width: 3,  height: 4  },
];

// ── Pipeline steps ────────────────────────────────────────────────────────────

export interface PipelineStep {
  status:    VideoJobStatus;
  label:     string;
  sublabel:  string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { status: "preparing",   label: "Preparing",   sublabel: "Setting up generation…" },
  { status: "generating",  label: "Generating",  sublabel: "AI is creating your video…" },
  { status: "rendering",   label: "Rendering",   sublabel: "Processing frames…" },
  { status: "optimizing",  label: "Optimizing",  sublabel: "Finalizing output…" },
  { status: "uploading",   label: "Uploading",   sublabel: "Saving to your library…" },
  { status: "completed",   label: "Complete",    sublabel: "Your video is ready!" },
];

// ── Library filters ───────────────────────────────────────────────────────────

export interface VideoLibraryFilters {
  query?:         string;
  status?:        VideoJobStatus | "all" | "active";
  style?:         string;
  aspectRatio?:   VideoAspectRatio;
  projectId?:     string;
  showFavorites?: boolean;
  showArchived?:  boolean;
  sortBy?:        "created_at" | "updated_at" | "title" | "duration_sec";
  sortDir?:       "asc" | "desc";
}

// ── Providers ─────────────────────────────────────────────────────────────────

export interface VideoProviderConfig {
  id:         string;
  name:       string;
  models:     { id: string; name: string; maxDuration: number }[];
  maxDuration: number;
  features:   string[];
  requiresKey: string;
}

export const VIDEO_PROVIDERS: VideoProviderConfig[] = [
  {
    id:          "luma",
    name:        "Luma Dream Machine",
    models:      [{ id: "dream-machine", name: "Dream Machine v1.5", maxDuration: 10 }],
    maxDuration: 10,
    features:    ["text-to-video", "high-quality", "fast"],
    requiresKey: "LUMA_API_KEY",
  },
  {
    id:          "mock",
    name:        "Demo Provider",
    models:      [{ id: "mock-v1", name: "Demo Mode", maxDuration: 60 }],
    maxDuration: 60,
    features:    ["demo", "no-key-required"],
    requiresKey: "",
  },
];
