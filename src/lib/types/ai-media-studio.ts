// AI Media Studio — shared TypeScript types

export type ProjectStatus = "active" | "archived" | "deleted";
export type AssetType = "audio" | "video" | "image" | "document" | "generated" | "other";
export type AssetStatus = "uploading" | "processing" | "ready" | "error" | "deleted";
export type TemplateType = "speech" | "voice" | "video" | "general";
export type FavoriteEntityType = "project" | "asset" | "template";

export interface AMSProject {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  is_favorite: boolean;
  tags: string[];
  language: string;
  voice_preset: string | null;
  video_preset: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AMSFolder {
  id: string;
  owner_id: string;
  project_id: string | null;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface AMSAsset {
  id: string;
  owner_id: string;
  project_id: string | null;
  folder_id: string | null;
  filename: string;
  original_name: string;
  asset_type: AssetType;
  mime_type: string | null;
  size_bytes: number;
  duration_sec: number | null;
  thumbnail_url: string | null;
  storage_path: string | null;
  public_url: string | null;
  status: AssetStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AMSTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template_type: TemplateType;
  config: Record<string, unknown>;
  thumbnail_url: string | null;
  is_public: boolean;
  owner_id: string | null;
  usage_count: number;
  created_at: string;
}

export interface AMSActivityLog {
  id: string;
  user_id: string;
  project_id: string | null;
  asset_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AMSUserPreferences {
  user_id: string;
  default_language: string;
  default_voice_preset: string | null;
  default_video_preset: string | null;
  notifications: {
    upload_complete: boolean;
    upload_failed: boolean;
    project_created: boolean;
    storage_warning: boolean;
  };
  ui_preferences: {
    theme: "system" | "light" | "dark";
    sidebar_collapsed: boolean;
    default_view: "grid" | "list";
  };
  updated_at: string;
}

export interface AMSStorageUsage {
  user_id: string;
  used_bytes: number;
  quota_bytes: number;
  asset_count: number;
  project_count: number;
  updated_at: string;
}

// ── Upload state ──────────────────────────────────────────────────────────────

export type UploadStatus = "pending" | "uploading" | "done" | "error" | "cancelled";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0–100
  error?: string;
  assetId?: string;
}

// ── Create / Update DTOs ──────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  tags?: string[];
  language?: string;
  voice_preset?: string;
  video_preset?: string;
  thumbnail_url?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: ProjectStatus;
  is_favorite?: boolean;
}

export interface CreateAssetInput {
  project_id?: string;
  folder_id?: string;
  filename: string;
  original_name: string;
  asset_type: AssetType;
  mime_type?: string;
  size_bytes: number;
  duration_sec?: number;
  thumbnail_url?: string;
  storage_path?: string;
  public_url?: string;
  metadata?: Record<string, unknown>;
}

// ── Filters ───────────────────────────────────────────────────────────────────

export type ProjectSortKey = "updated_at" | "created_at" | "name";
export type AssetSortKey = "created_at" | "filename" | "size_bytes";

export interface ProjectFilters {
  status?: ProjectStatus;
  is_favorite?: boolean;
  tags?: string[];
  query?: string;
  sort?: ProjectSortKey;
  ascending?: boolean;
}

export interface AssetFilters {
  project_id?: string;
  asset_type?: AssetType;
  status?: AssetStatus;
  query?: string;
  sort?: AssetSortKey;
  ascending?: boolean;
}
