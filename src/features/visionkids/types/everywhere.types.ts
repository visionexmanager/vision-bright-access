export type Platform = "web" | "pwa" | "android" | "ios" | "windows" | "macos" | "tv";

export interface Device {
  id: string;
  user_id: string;
  device_key: string;
  name: string;
  platform: Platform;
  app_version: string | null;
  last_active: string;
  created_at: string;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  device_id: string | null;
  login_at: string;
  ended_at: string | null;
  revoked: boolean;
}

export type SyncEntity =
  | "reading_progress" | "game_progress" | "xp" | "coins" | "achievements"
  | "lessons" | "quiz_results" | "projects" | "favorites" | "bookmarks" | "settings";

export type SyncOp = "upsert" | "delete";

/** A queued offline change (mirrored in IndexedDB and, on flush, in Supabase). */
export interface SyncQueueItem {
  id: string;
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  payload: Record<string, unknown>;
  clientTs: number;
  status: "pending" | "applied" | "conflict";
}

export type SyncEventKind = "sync_start" | "sync_complete" | "sync_failed" | "conflict_resolved" | "conflict_kept_both";

export type DownloadKind = "story" | "audio" | "lesson" | "game" | "quiz" | "worksheet";

export interface Download {
  user_id: string;
  content_kind: DownloadKind;
  ref_id: string;
  title: string;
  size_kb: number;
  device_key: string | null;
  downloaded_at: string;
}

export interface UserPreferences {
  user_id: string;
  low_data: boolean;
  wifi_only: boolean;
  auto_download: boolean;
  tv_mode: boolean;
  audio_guidance: boolean;
  updated_at: string;
}

export type ConnectionStatus = "online" | "offline";
export type SyncStatus = "idle" | "syncing" | "complete" | "failed";

export interface SyncResult {
  applied: number;
  conflicts: number;
  failed: number;
}
