/**
 * Centralized React Query key factory.
 *
 * All query keys live here so:
 *  - invalidation is consistent (no typo mismatches)
 *  - keys are typed
 *  - relationships between keys are visible
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.academy.profile(userId), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.points.total(userId) })
 */

export const queryKeys = {
  // ── Academy ──────────────────────────────────────────────────────────────
  academy: {
    all:          ()           => ["academy"] as const,
    profile:      (uid: string) => ["academy", "profile", uid] as const,
    chatHistory:  (uid: string) => ["academy", "chat", uid] as const,
    xpEvents:     (uid: string) => ["academy", "xp-events", uid] as const,

    // ── Future modules (Phase 1 architecture prep — no live callers yet) ────
    courses:         { list: (level?: string) => ["academy", "courses", level ?? "all"] as const, item: (id: string) => ["academy", "courses", id] as const },
    instructors:     { list: ()               => ["academy", "instructors"] as const, item: (id: string) => ["academy", "instructors", id] as const },
    studentServices: { list: (uid: string)    => ["academy", "student-services", uid] as const },
    aiLearning:      { paths: (uid: string)   => ["academy", "ai-learning", uid] as const },
    library:         { list: (subject?: string, level?: string) => ["academy", "library", subject ?? "all", level ?? "all"] as const, bookmarks: (uid: string) => ["academy", "library", "bookmarks", uid] as const },
    scholarships:    { list: (country?: string) => ["academy", "scholarships", country ?? "all"] as const, item: (id: string) => ["academy", "scholarships", id] as const },
    universities:    { list: (country?: string) => ["academy", "universities", country ?? "all"] as const },
    community:       { posts: (roomId: string) => ["academy", "community", roomId] as const },
    certificates:    { list: (uid: string)    => ["academy", "certificates", uid] as const },
    analytics:       { summary: (uid: string) => ["academy", "analytics", uid] as const },
    notifications:   { list: (uid: string)    => ["academy", "notifications", uid] as const },
    accessibility:   { prefs: (uid: string)   => ["academy", "accessibility", uid] as const },
  },

  // ── Points / Wallet ───────────────────────────────────────────────────────
  points: {
    all:     ()           => ["points"] as const,
    total:   (uid: string) => ["points-total", uid] as const,
    history: (uid: string) => ["points-history", uid] as const,
  },

  // ── User / Profile ────────────────────────────────────────────────────────
  user: {
    all:     ()           => ["user"] as const,
    profile: (uid: string) => ["user", "profile", uid] as const,
    trial:   (uid: string) => ["user", "trial", uid] as const,
    roles:   (uid: string) => ["user", "roles", uid] as const,
  },

  // ── Simulations ───────────────────────────────────────────────────────────
  simulation: {
    all:      ()                           => ["simulation"] as const,
    progress: (uid: string, simId: string) => ["simulation", "progress", uid, simId] as const,
    summary:  (uid: string)                => ["simulation", "summary", uid] as const,
    list:     ()                           => ["simulation", "list"] as const,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    all:  ()             => ["content"] as const,
    list: (cat?: string) => ["content", "list", cat ?? "all"] as const,
    item: (id: string)   => ["content", "item", id] as const,
  },

  // ── Community / Voice Rooms ───────────────────────────────────────────────
  community: {
    rooms:    ()            => ["community", "rooms"] as const,
    room:     (id: string)  => ["community", "room", id] as const,
    members:  (id: string)  => ["community", "members", id] as const,
  },

  // ── Marketplace / Bazaar ──────────────────────────────────────────────────
  bazaar: {
    all:     ()           => ["bazaar"] as const,
    shops:   ()           => ["bazaar", "shops"] as const,
    shop:    (id: string) => ["bazaar", "shop", id] as const,
    products: ()          => ["bazaar", "products"] as const,
  },

  // ── TV / Radio ────────────────────────────────────────────────────────────
  media: {
    tvChannels:    ()           => ["media", "tv-channels"] as const,
    radioStations: ()           => ["media", "radio-stations"] as const,
    tvToken:       (id: string) => ["media", "tv-token", id] as const,
    radioToken:    (id: string) => ["media", "radio-token", id] as const,
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    all:    (uid: string) => ["notifications", uid] as const,
    unread: (uid: string) => ["notifications", "unread", uid] as const,
  },

  // ── Leaderboard ───────────────────────────────────────────────────────────
  leaderboard: {
    global: () => ["leaderboard", "global"] as const,
    weekly: () => ["leaderboard", "weekly"] as const,
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  messages: {
    all:    (uid: string)                            => ["messages", uid] as const,
    thread: (uid: string, otherId: string)           => ["messages", uid, "thread", otherId] as const,
    unread: (uid: string)                            => ["messages", uid, "unread"] as const,
  },
} as const;
