/**
 * API client — thin wrapper around fetch.
 * All requests go to Next.js rewrites → backend.
 * Never throws: returns { data } | { error }.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

class ApiError extends Error {
  constructor(
    public status:  number,
    public code:    string,
    message:        string
  ) { super(message); }
}

async function request<T>(
  path:    string,
  options: RequestInit = {},
  token?:  string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "REQUEST_ERROR", err.message ?? "Request failed");
  }

  // Backend wraps in { success, data } — unwrap
  return body.data !== undefined ? body.data : body;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string, displayName: string) =>
    request<TokenPair>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) }),

  login: (email: string, password: string) =>
    request<TokenPair>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  refresh: (refreshToken: string) =>
    request<TokenPair>("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  logout: (token: string, refreshToken: string) =>
    request("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }, token),

  me: (token: string) =>
    request<User>("/api/auth/me", {}, token),
};

// ── Channels ───────────────────────────────────────────────────────────────
export const channels = {
  list: (params: ChannelFilter = {}, token?: string) => {
    const q = new URLSearchParams();
    if (params.categoryId) q.set("category",  params.categoryId);
    if (params.country)    q.set("country",    params.country);
    if (params.quality)    q.set("quality",    params.quality);
    if (params.search)     q.set("search",     params.search);
    if (params.featured)   q.set("featured",   "true");
    if (params.limit)      q.set("limit",      String(params.limit));
    if (params.offset)     q.set("offset",     String(params.offset));
    return request<PaginatedResponse<Channel>>(`/api/tv/channels?${q}`, {}, token);
  },

  get: (id: string) =>
    request<Channel>(`/api/tv/channels/${id}`),

  categories: () =>
    request<Category[]>("/api/tv/channels/categories"),

  sources: (channelId: string, token: string) =>
    request<StreamSource[]>(`/api/tv/channels/${channelId}/sources`, {}, token),
};

// ── Stream ─────────────────────────────────────────────────────────────────
export const stream = {
  start: (channelId: string, token: string) =>
    request<StreamSession>("/api/tv/stream/start", {
      method: "POST", body: JSON.stringify({ channelId }),
    }, token),

  switch: (streamToken: string, failedSourceId: string, token: string) =>
    request<StreamSwitchResult>("/api/tv/stream/switch", {
      method: "POST", body: JSON.stringify({ token: streamToken, failedSourceId }),
    }, token),

  stop: (streamToken: string, watchedSeconds: number, token: string) =>
    request("/api/tv/stream/stop", {
      method: "POST", body: JSON.stringify({ token: streamToken, watchedSeconds }),
    }, token),

  heartbeat: (streamToken: string, bufferHealth: number, token: string) =>
    request("/api/tv/stream/heartbeat", {
      method: "POST", body: JSON.stringify({ token: streamToken, bufferHealth }),
    }, token).catch(() => {}), // never block on heartbeat
};

// ── Favorites ──────────────────────────────────────────────────────────────
export const favorites = {
  list: (token: string) =>
    request<Channel[]>("/api/tv/favorites", {}, token),

  toggle: (channelId: string, token: string) =>
    request<{ isFavorite: boolean }>(`/api/tv/favorites/${channelId}`, { method: "POST" }, token),

  check: (channelId: string, token: string) =>
    request<{ isFavorite: boolean }>(`/api/tv/favorites/${channelId}`, {}, token),
};

// ── User ───────────────────────────────────────────────────────────────────
export const users = {
  profile: (token: string) =>
    request<UserProfile>("/api/tv/users/me", {}, token),

  preferences: (token: string) =>
    request<UserPreferences>("/api/tv/users/me/preferences", {}, token),

  updatePreferences: (prefs: Partial<UserPreferences>, token: string) =>
    request<UserPreferences>("/api/tv/users/me/preferences", {
      method: "PATCH", body: JSON.stringify(prefs),
    }, token),

  history: (token: string, limit = 20, offset = 0) =>
    request<PaginatedResponse<WatchHistoryItem>>(
      `/api/tv/users/me/history?limit=${limit}&offset=${offset}`, {}, token
    ),

  stats: (token: string, days = 30) =>
    request<WatchStat[]>(`/api/tv/users/me/stats?days=${days}`, {}, token),
};

// ── Recommendations ────────────────────────────────────────────────────────
export const recommendations = {
  forUser: (token: string, limit = 10) =>
    request<Channel[]>(`/api/tv/recommendations?limit=${limit}`, {}, token),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analytics = {
  topChannels: (limit = 10) =>
    request<Channel[]>(`/api/tv/analytics/channels/top?limit=${limit}`),
};

// ── Types ──────────────────────────────────────────────────────────────────
export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface User {
  id:    string;
  email: string;
  role:  string;
}

export interface UserProfile extends User {
  displayName:  string;
  avatarUrl:    string | null;
  favoriteCount: number;
  historyCount:  number;
  createdAt:    string;
}

export interface UserPreferences {
  language:             string;
  quality:              "auto" | "SD" | "HD" | "FHD";
  subtitlesEnabled:     boolean;
  autoplay:             boolean;
  notificationsEnabled: boolean;
  preferredCategories:  string[];
  preferredCountries:   string[];
}

export interface Channel {
  id:          string;
  slug:        string;
  name:        string;
  nameAr:      string;
  description: string | null;
  logoUrl:     string | null;
  country:     string | null;
  language:    string | null;
  quality:     string;
  isFeatured:  boolean;
  viewCount:   number;
  category:    Category | null;
}

export interface Category {
  id:           string;
  slug:         string;
  name:         string;
  nameAr:       string;
  icon:         string | null;
  channelCount: number;
}

export interface StreamSource {
  id:          string;
  url:         string;
  type:        string;
  priority:    number;
  label:       string;
  reliability: number;
  latencyMs:   number | null;
  isActive:    boolean;
}

export interface StreamSession {
  token:     string;
  sourceId:  string;
  url:       string;
  type:      string;
  quality:   string;
  expiresAt: string;
  channelId: string;
}

export interface StreamSwitchResult {
  sourceId:  string;
  url:       string;
  type:      string;
  quality:   string;
  channelId: string;
}

export interface ChannelFilter {
  categoryId?: string;
  country?:    string;
  quality?:    string;
  search?:     string;
  featured?:   boolean;
  limit?:      number;
  offset?:     number;
}

export interface PaginatedResponse<T> {
  data:   T[];
  total:  number;
  limit:  number;
  offset: number;
}

export interface WatchHistoryItem {
  id:          string;
  watchedAt:   string;
  durationSec: number;
  channelId:   string;
  name:        string;
  nameAr:      string;
  logoUrl:     string | null;
  quality:     string;
}

export interface WatchStat {
  day:            string;
  totalWatchSec:  number;
  sessions:       number;
  uniqueChannels: number;
}
