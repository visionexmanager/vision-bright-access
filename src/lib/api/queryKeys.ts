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

    // ── LMS (Phase 1 backend — courses/lessons/enrollment/progress) ─────────
    lms: {
      catalog:       (filtersKey: string)              => ["academy", "lms", "catalog", filtersKey] as const,
      course:        (courseId: string)                => ["academy", "lms", "course", courseId] as const,
      similar:       (courseId: string)                => ["academy", "lms", "similar", courseId] as const,
      modules:       (courseId: string)                => ["academy", "lms", "modules", courseId] as const,
      lessons:       (courseId: string)                => ["academy", "lms", "lessons", courseId] as const,
      lesson:        (lessonId: string)                => ["academy", "lms", "lesson", lessonId] as const,
      enrollment:    (uid: string, courseId: string)    => ["academy", "lms", "enrollment", uid, courseId] as const,
      myEnrollments: (uid: string)                      => ["academy", "lms", "enrollments", uid] as const,
      progress:      (uid: string, courseId: string)    => ["academy", "lms", "progress", uid, courseId] as const,
      allProgress:   (uid: string)                      => ["academy", "lms", "progress", uid] as const,
      notes:         (uid: string, lessonId: string)    => ["academy", "lms", "notes", uid, lessonId] as const,
      allNotes:      (uid: string)                      => ["academy", "lms", "notes", uid] as const,
      bookmarks:     (uid: string, lessonId: string)    => ["academy", "lms", "bookmarks", uid, lessonId] as const,
      allBookmarks:  (uid: string)                      => ["academy", "lms", "bookmarks", uid] as const,
      reviews:       (courseId: string)                 => ["academy", "lms", "reviews", courseId] as const,
      tracks:        ()                                 => ["academy", "lms", "tracks"] as const,
      track:         (trackId: string)                  => ["academy", "lms", "track", trackId] as const,
      trackProgress: (uid: string, trackId: string)      => ["academy", "lms", "track-progress", uid, trackId] as const,
      categories:    ()                                 => ["academy", "lms", "categories"] as const,
    },

    // ── Instructor Platform (Phase 1 backend) ────────────────────────────────
    instructor: {
      myApplication:   (uid: string)         => ["academy", "instructor", "application", uid] as const,
      allApplications: ()                    => ["academy", "instructor", "applications"] as const,
      myProfile:       (uid: string)         => ["academy", "instructor", "my-profile", uid] as const,
      profile:         (instructorId: string) => ["academy", "instructor", "profile", instructorId] as const,
      /** Public course list (published only) — for the instructor's public profile page. */
      courses:         (instructorId: string) => ["academy", "instructor", "courses", instructorId] as const,
      /** Private course list (all statuses, own dashboard) — deliberately a different key from
       *  `courses` above so the two never collide in the cache despite sharing an instructorId. */
      myCourses:       (instructorId: string) => ["academy", "instructor", "my-courses", instructorId] as const,
    },

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

  // ── Career Center (Phase 1 backend — profile/jobs/applications/etc.) ───────
  career: {
    profile:         (uid: string)          => ["career", "profile", uid] as const,
    jobs:            (filtersKey: string)   => ["career", "jobs", filtersKey] as const,
    job:             (jobId: string)        => ["career", "job", jobId] as const,
    companies:       ()                     => ["career", "companies"] as const,
    recommendedJobs: (uid: string)          => ["career", "recommended-jobs", uid] as const,
    applications:    (uid: string)          => ["career", "applications", uid] as const,
    certificates:    (uid: string)          => ["career", "certificates", uid] as const,
    goals:           (uid: string)          => ["career", "goals", uid] as const,
    notifications:   (uid: string)          => ["career", "notifications", uid] as const,
    messages:        (uid: string)          => ["career", "messages", uid] as const,
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

  // ── VX Coin Purchases ────────────────────────────────────────────────────
  vxCoins: {
    myOrders:  (uid: string)          => ["vxCoins", "my-orders", uid] as const,
    adminList: (status: string)       => ["vxCoins", "admin-list", status] as const,
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

  // ── Library (books/audiobooks — Phase 1 architecture prep, mock data) ─────
  // Distinct top-level namespace from `academy.library` (course resources/PDFs) —
  // this is the consumer books/audiobooks section, no relation to Academy.
  library: {
    catalog:         (filtersKey: string) => ["library", "catalog", filtersKey] as const,
    book:            (bookId: string)     => ["library", "book", bookId] as const,
    categories:      ()                    => ["library", "categories"] as const,
    authors:         ()                    => ["library", "authors"] as const,
    author:          (authorId: string)   => ["library", "author", authorId] as const,
    audiobooks:      (filtersKey: string) => ["library", "audiobooks", filtersKey] as const,
    audiobook:       (audiobookId: string) => ["library", "audiobook", audiobookId] as const,
    quotes:          ()                    => ["library", "quotes"] as const,
    search:          (query: string)      => ["library", "search", query] as const,
    myShelf:         (uid: string)        => ["library", "my-shelf", uid] as const,
    readingLists:    (uid: string)        => ["library", "reading-lists", uid] as const,
    favorites:       (uid: string)        => ["library", "favorites", uid] as const,
    continueReading: (uid: string)        => ["library", "continue-reading", uid] as const,
    downloads:       (uid: string)        => ["library", "downloads", uid] as const,
    reviews:         (bookId: string)     => ["library", "reviews", bookId] as const,

    // ── Phase 3: home page ────────────────────────────────────────────────
    trending:         (days: number)       => ["library", "trending", days] as const,
    homeStats:        ()                    => ["library", "home-stats"] as const,
    recommendations:  (uid: string)        => ["library", "recommendations", uid] as const,
    challenges:       ()                    => ["library", "challenges"] as const,
    popularSearches:  ()                    => ["library", "popular-searches"] as const,
    dailyQuote:       (dateKey: string)    => ["library", "daily-quote", dateKey] as const,

    // ── Phase 4: categories & books explorer ────────────────────────────────
    categoryBySlug:      (slug: string)      => ["library", "category-by-slug", slug] as const,
    subcategories:       (parentId: string)  => ["library", "subcategories", parentId] as const,
    categoryStats:       (categoryId: string) => ["library", "category-stats", categoryId] as const,
    categoriesWithStats: ()                   => ["library", "categories-with-stats"] as const,
    relatedCategories:   (categoryId: string) => ["library", "related-categories", categoryId] as const,
    popularTags:         ()                   => ["library", "popular-tags"] as const,
    recentlyViewed:      (uid: string)        => ["library", "recently-viewed", uid] as const,
    catalogCount:        (filtersKey: string) => ["library", "catalog-count", filtersKey] as const,
    quotesByBook:        (bookId: string)     => ["library", "quotes-by-book", bookId] as const,

    // ── Phase 5: book details ────────────────────────────────────────────
    bookReviews:      (bookId: string)          => ["library", "book-reviews", bookId] as const,
    myReview:         (bookId: string, uid: string) => ["library", "my-review", bookId, uid] as const,
    readersAlsoRead:  (bookId: string)          => ["library", "readers-also-read", bookId] as const,
    savedQuotes:      (uid: string, bookId: string) => ["library", "saved-quotes", uid, bookId] as const,
    borrowStatus:     (bookId: string, uid: string) => ["library", "borrow-status", bookId, uid] as const,
    purchaseStatus:   (bookId: string, uid: string) => ["library", "purchase-status", bookId, uid] as const,
    aiAssistant:      (bookId: string, mode: string, key: string) => ["library", "ai-assistant", bookId, mode, key] as const,
    chapters:         (bookId: string)          => ["library", "chapters", bookId] as const,

    // ── Phase 6: reader engine ───────────────────────────────────────────
    bookFiles:        (bookId: string)          => ["library", "book-files", bookId] as const,
    bookmarks:        (bookId: string, uid: string) => ["library", "bookmarks", bookId, uid] as const,
    notes:            (bookId: string, uid: string) => ["library", "notes", bookId, uid] as const,
    highlights:       (bookId: string, uid: string) => ["library", "highlights", bookId, uid] as const,
    readerSettings:   (uid: string)              => ["library", "reader-settings", uid] as const,
    readerAnalytics:  (bookId: string, uid: string) => ["library", "reader-analytics", bookId, uid] as const,

    // ── Phase 6.5: AI reading assistant ──────────────────────────────────
    chatSessions:     (bookId: string, uid: string) => ["library", "ai-chat-sessions", bookId, uid] as const,
    chatHistory:      (bookId: string, sessionId: string) => ["library", "ai-chat-history", bookId, sessionId] as const,
    aiSummary:        (bookId: string, chapterId: string, scope: string, length: string) => ["library", "ai-summary", bookId, chapterId, scope, length] as const,
    aiFlashcards:     (bookId: string, uid: string) => ["library", "ai-flashcards", bookId, uid] as const,
    aiQuizAttempts:   (bookId: string, uid: string) => ["library", "ai-quiz-attempts", bookId, uid] as const,
    readingCoach:     (bookId: string, uid: string) => ["library", "reading-coach", bookId, uid] as const,

    // ── Phase 7: Audiobooks platform ─────────────────────────────────────
    narrators:            (filtersKey: string) => ["library", "narrators", filtersKey] as const,
    narrator:             (narratorId: string) => ["library", "narrator", narratorId] as const,
    narratorStats:        (narratorId: string) => ["library", "narrator-stats", narratorId] as const,
    audiobookChapters:    (audiobookId: string) => ["library", "audiobook-chapters", audiobookId] as const,
    listeningStats:       (uid: string) => ["library", "listening-stats", uid] as const,
    mostListenedAudiobooks: (limit: number) => ["library", "most-listened-audiobooks", limit] as const,

    // ── Phase 8: advanced AI assistant ───────────────────────────────────
    aiPreferences:    (uid: string)              => ["library", "ai-preferences", uid] as const,
    aiActivityLog:    (uid: string, bookId: string) => ["library", "ai-activity-log", uid, bookId] as const,

    // ── Phase 9: Author Publishing Studio ────────────────────────────────
    studio: {
      ownAuthorProfile:   (uid: string)             => ["library", "studio", "own-author-profile", uid] as const,
      books:              (authorId: string)        => ["library", "studio", "books", authorId] as const,
      bookDetail:         (bookId: string)           => ["library", "studio", "book-detail", bookId] as const,
      dashboardStats:     (authorId: string)         => ["library", "studio", "dashboard-stats", authorId] as const,
      monthlyStats:       (authorId: string)         => ["library", "studio", "monthly-stats", authorId] as const,
      pendingReview:      (authorId: string)         => ["library", "studio", "pending-review", authorId] as const,
      gallery:            (bookId: string)           => ["library", "studio", "gallery", bookId] as const,
      collaborators:      (bookId: string)           => ["library", "studio", "collaborators", bookId] as const,
      myCollaborations:   (uid: string)              => ["library", "studio", "my-collaborations", uid] as const,
      comments:           (bookId: string, chapterId?: string) => ["library", "studio", "comments", bookId, chapterId ?? "all"] as const,
      suggestions:        (chapterId: string)        => ["library", "studio", "suggestions", chapterId] as const,
      versions:           (chapterId: string)        => ["library", "studio", "versions", chapterId] as const,
      coupons:            (bookId: string)           => ["library", "studio", "coupons", bookId] as const,
      regionalPrices:     (bookId: string)           => ["library", "studio", "regional-prices", bookId] as const,
      bundles:            (authorId: string)         => ["library", "studio", "bundles", authorId] as const,
      donations:          (bookId: string)           => ["library", "studio", "donations", bookId] as const,
      analytics:          (bookId: string, days: number) => ["library", "studio", "analytics", bookId, days] as const,
    },

    // ── Phase 10: Book Marketplace ───────────────────────────────────────
    collections:        (type: string)               => ["library", "collections", type] as const,
    allCollections:     ()                             => ["library", "all-collections"] as const,
    collectionBySlug:   (slug: string)                => ["library", "collection-by-slug", slug] as const,
    collectionBooks:    (collectionId: string)        => ["library", "collection-books", collectionId] as const,
    popularPublishers:  ()                             => ["library", "popular-publishers"] as const,
    publisherBySlug:    (slug: string)                 => ["library", "publisher-by-slug", slug] as const,
    isFollowingPublisher: (publisherId: string, uid: string) => ["library", "is-following-publisher", publisherId, uid] as const,
    series:             (seriesId: string)             => ["library", "series", seriesId] as const,
    seriesBySlug:       (slug: string)                 => ["library", "series-by-slug", slug] as const,
    seriesBooks:        (seriesId: string)             => ["library", "series-books", seriesId] as const,
    bookAwards:         (bookId: string)               => ["library", "book-awards", bookId] as const,
    wishlist:           (uid: string)                  => ["library", "wishlist", uid] as const,
    wishlistIds:        (uid: string)                  => ["library", "wishlist-ids", uid] as const,
    myLicenses:         (uid: string)                  => ["library", "my-licenses", uid] as const,
    licenseSeats:       (licenseId: string)            => ["library", "license-seats", licenseId] as const,
    reviewMedia:        (reviewId: string)             => ["library", "review-media", reviewId] as const,
    myHelpfulVotes:     (uid: string, bookId: string)   => ["library", "my-helpful-votes", uid, bookId] as const,
    semanticSearch:     (query: string)                => ["library", "semantic-search", query] as const,
    achievements:       ()                              => ["library", "achievements"] as const,
    myAchievements:     (uid: string)                   => ["library", "my-achievements", uid] as const,
    todaysDailyReward:  (uid: string)                   => ["library", "todays-daily-reward", uid] as const,
    dailyRecommendations: (uid: string)                 => ["library", "daily-recommendations", uid] as const,
    bundlesForBook:       (bookId: string)               => ["library", "bundles-for-book", bookId] as const,
    bundleById:           (bundleId: string)              => ["library", "bundle-by-id", bundleId] as const,

    // ── Phase 11: Global Digital Library ─────────────────────────────────
    relatedBooks:         (bookId: string)                => ["library", "related-books", bookId] as const,
    learningPaths:        ()                               => ["library", "learning-paths"] as const,
    learningPathBySlug:   (slug: string)                   => ["library", "learning-path-by-slug", slug] as const,
    seriesSuggestions:    (bookId: string)                 => ["library", "series-suggestions", bookId] as const,
    pendingSeriesSuggestions: ()                            => ["library", "pending-series-suggestions"] as const,
    bookTranslations:     (bookId: string)                 => ["library", "book-translations", bookId] as const,
    bookTranslation:      (bookId: string, lang: string)    => ["library", "book-translation", bookId, lang] as const,
    importReviewQueue:    ()                               => ["library", "import-review-queue"] as const,
    bookEditions:         (bookId: string)                 => ["library", "book-editions", bookId] as const,
    readingListShares:    (listId: string)                 => ["library", "reading-list-shares", listId] as const,
    sharedReadingLists:   (uid: string)                    => ["library", "shared-reading-lists", uid] as const,
    kgEntity:             (slug: string)                   => ["library", "kg-entity", slug] as const,
    kgEntitySearch:       (query: string)                  => ["library", "kg-entity-search", query] as const,
    kgEntitiesForBook:    (bookId: string)                 => ["library", "kg-entities-for-book", bookId] as const,
    kgConnectedEntities:  (entityId: string)                => ["library", "kg-connected-entities", entityId] as const,
    kgBooksForEntity:     (entityId: string)                => ["library", "kg-books-for-entity", entityId] as const,
    searchInsideBook:     (bookId: string, query: string)   => ["library", "search-inside-book", bookId, query] as const,
    auditLogs:            ()                               => ["library", "audit-logs"] as const,
    backgroundJobs:       ()                               => ["library", "background-jobs"] as const,

    // ── Phase 12: Reading Community ──────────────────────────────────────
    readerProfile:        (userId: string)                 => ["library", "reader-profile", userId] as const,
    readerProfileStats:   (userId: string)                 => ["library", "reader-profile-stats", userId] as const,
    publicReadingLists:   (userId: string)                 => ["library", "public-reading-lists", userId] as const,
    followers:            (userId: string)                 => ["library", "followers", userId] as const,
    following:            (userId: string)                 => ["library", "following", userId] as const,
    isFollowing:          (targetUserId: string, viewerId: string) => ["library", "is-following", targetUserId, viewerId] as const,
    clubs:                (filter: string)                 => ["library", "clubs", filter] as const,
    club:                 (slugOrId: string)                => ["library", "club", slugOrId] as const,
    clubMembers:          (clubId: string)                  => ["library", "club-members", clubId] as const,
    myClubMembership:     (clubId: string, uid: string)     => ["library", "my-club-membership", clubId, uid] as const,
    clubAnnouncements:    (clubId: string)                  => ["library", "club-announcements", clubId] as const,
    clubSchedule:         (clubId: string)                  => ["library", "club-schedule", clubId] as const,
    clubReadingProgress:  (clubId: string)                  => ["library", "club-reading-progress", clubId] as const,
    discussionTopics:     (contextType: string, contextId: string) => ["library", "discussion-topics", contextType, contextId] as const,
    discussionTopic:      (topicId: string)                 => ["library", "discussion-topic", topicId] as const,
    discussionReplies:    (topicId: string)                 => ["library", "discussion-replies", topicId] as const,
    discussionPoll:       (topicId: string)                 => ["library", "discussion-poll", topicId] as const,
    readingGoals:         (uid: string)                     => ["library", "reading-goals", uid] as const,
    readingStreak:        (uid: string)                     => ["library", "reading-streak", uid] as const,
    communityChallenges:  (scope: string)                   => ["library", "community-challenges", scope] as const,
    libraryEvents:        (filter: string)                  => ["library", "events", filter] as const,
    libraryEvent:         (eventId: string)                 => ["library", "event", eventId] as const,
    eventRsvps:           (eventId: string)                 => ["library", "event-rsvps", eventId] as const,
    myEventRsvp:          (eventId: string, uid: string)    => ["library", "my-event-rsvp", eventId, uid] as const,
    leaderboard:          (metric: string, period: string)  => ["library", "leaderboard", metric, period] as const,
    userModeration:       (uid: string, clubId: string)     => ["library", "user-moderation", uid, clubId] as const,

    // ── Phase 13: Learning Hub ────────────────────────────────────────────
    learningHubPaths:        (scope: string)                  => ["library", "lh-paths", scope] as const,
    learningHubPath:         (pathId: string)                 => ["library", "lh-path", pathId] as const,
    learningHubPathItems:    (pathId: string)                 => ["library", "lh-path-items", pathId] as const,
    learningHubPathPrereqs:  (pathId: string)                 => ["library", "lh-path-prereqs", pathId] as const,
    learningHubEnrollment:   (uid: string, pathId: string)     => ["library", "lh-enrollment", uid, pathId] as const,
    learningHubEnrollments:  (uid: string)                    => ["library", "lh-enrollments", uid] as const,
    learningHubPathProgress: (pathId: string)                 => ["library", "lh-path-progress", pathId] as const,
    bookCourseLink:          (bookId: string)                 => ["library", "book-course-link", bookId] as const,
    courseLearningObjectives:(courseId: string)                => ["library", "course-objectives", courseId] as const,
    notebooks:               (uid: string)                    => ["library", "notebooks", uid] as const,
    flashcardDecks:          (uid: string)                    => ["library", "flashcard-decks", uid] as const,
    flashcardDeck:           (deckId: string)                 => ["library", "flashcard-deck", deckId] as const,
    dueFlashcards:           (deckId: string)                 => ["library", "due-flashcards", deckId] as const,
    learningQuizzes:         (scope: string)                  => ["library", "lh-quizzes", scope] as const,
    learningQuiz:            (quizId: string)                 => ["library", "lh-quiz", quizId] as const,
    quizForAttempt:          (quizId: string)                 => ["library", "quiz-for-attempt", quizId] as const,
    myQuizAttempts:          (uid: string, quizId: string)     => ["library", "my-quiz-attempts", uid, quizId] as const,
    weakTopics:              (uid: string)                    => ["library", "weak-topics", uid] as const,
    myCertificates:          (uid: string)                    => ["library", "my-certificates", uid] as const,
    certificateVerification: (certNumber: string)             => ["library", "certificate-verify", certNumber] as const,
    groupSharedNotes:        (clubId: string)                 => ["library", "group-shared-notes", clubId] as const,
    groupAssignments:        (clubId: string)                 => ["library", "group-assignments", clubId] as const,
    groupSubmissions:        (assignmentId: string)            => ["library", "group-submissions", assignmentId] as const,
    groupPeerReviews:        (submissionId: string)            => ["library", "group-peer-reviews", submissionId] as const,
    groupTeacherFeedback:    (submissionId: string)            => ["library", "group-teacher-feedback", submissionId] as const,
    academyCourseBooks:      (courseId: string)                => ["library", "academy-course-books", courseId] as const,
    instructorRecommendations: (instructorId: string)           => ["library", "instructor-recommendations", instructorId] as const,
    learningAnalytics:       (uid: string, bookId: string)      => ["library", "learning-analytics", uid, bookId] as const,

    // ── Phase 14: Knowledge & Research Platform ──────────────────────────
    kgContentLinks:          (entityId: string)                 => ["library", "kg-content-links", entityId] as const,
    knowledgeMap:            (rootEntityId: string)              => ["library", "knowledge-map", rootEntityId] as const,
    trendingTopics:          ()                                  => ["library", "trending-topics"] as const,
    timelines:               (timelineType: string)              => ["library", "timelines", timelineType] as const,
    timeline:                (timelineId: string)                => ["library", "timeline", timelineId] as const,
    savedSearches:           (uid: string)                       => ["library", "saved-searches", uid] as const,
    searchSuggestions:       (prefix: string)                    => ["library", "search-suggestions", prefix] as const,
    searchHistory:           (uid: string)                       => ["library", "search-history", uid] as const,
    aiSearch:                (query: string)                     => ["library", "ai-search", query] as const,
    researchAnalyses:        (uid: string)                       => ["library", "research-analyses", uid] as const,
    researchAnalysis:        (analysisId: string)                => ["library", "research-analysis", analysisId] as const,
    researchProjects:        (uid: string)                       => ["library", "research-projects", uid] as const,
    researchProject:         (projectId: string)                 => ["library", "research-project", projectId] as const,
    researchProjectMembers:  (projectId: string)                 => ["library", "research-project-members", projectId] as const,
    researchProjectItems:    (projectId: string)                 => ["library", "research-project-items", projectId] as const,
    researchProjectComments: (projectId: string)                 => ["library", "research-project-comments", projectId] as const,
    researchProjectVersions: (projectId: string)                 => ["library", "research-project-versions", projectId] as const,

    // Phase 15: AI Personal Librarian
    librarianReadingHistory: (uid: string)                       => ["library", "librarian-reading-history", uid] as const,
    librarianEngagement:     (uid: string)                       => ["library", "librarian-engagement", uid] as const,
    librarianFavorites:      (uid: string)                       => ["library", "librarian-favorites", uid] as const,
    librarianFavoriteTopics: (uid: string)                       => ["library", "librarian-favorite-topics", uid] as const,
    librarianCourses:        (uid: string)                       => ["library", "librarian-courses", uid] as const,
    librarianCertificates:   (uid: string)                       => ["library", "librarian-certificates", uid] as const,
    librarianResearchProjects: (uid: string)                     => ["library", "librarian-research-projects", uid] as const,
    librarianSkills:         (uid: string)                       => ["library", "librarian-skills", uid] as const,
    librarianGoals:          (uid: string)                       => ["library", "librarian-goals", uid] as const,
    librarianPreferences:    (uid: string)                       => ["library", "librarian-preferences", uid] as const,
    librarianRecommendations: (uid: string)                      => ["library", "librarian-recommendations", uid] as const,
    librarianDailyPlan:      (uid: string, date: string)         => ["library", "librarian-daily-plan", uid, date] as const,
    librarianSummaries:      (uid: string, period: string)       => ["library", "librarian-summaries", uid, period] as const,
    librarianChatSessions:   (uid: string)                       => ["library", "librarian-chat-sessions", uid] as const,
    librarianChatMessages:   (sessionId: string)                 => ["library", "librarian-chat-messages", sessionId] as const,
    librarianDataRequests:   (uid: string)                       => ["library", "librarian-data-requests", uid] as const,

    // Phase 16: Enterprise & Organization Platform
    myOrganizations:         (uid: string)                       => ["library", "my-organizations", uid] as const,
    organization:            (orgId: string)                     => ["library", "organization", orgId] as const,
    organizationBySlug:      (slug: string)                      => ["library", "organization-slug", slug] as const,
    organizationMembers:     (orgId: string)                     => ["library", "organization-members", orgId] as const,
    organizationGroups:      (orgId: string)                     => ["library", "organization-groups", orgId] as const,
    organizationGroupMembers: (groupId: string)                  => ["library", "organization-group-members", groupId] as const,
    organizationPermissions: (orgId: string)                     => ["library", "organization-permissions", orgId] as const,
    organizationResources:   (orgId: string)                     => ["library", "organization-resources", orgId] as const,
    organizationLicenses:    (orgId: string)                     => ["library", "organization-licenses", orgId] as const,
    organizationSeatUsage:   (orgId: string)                     => ["library", "organization-seat-usage", orgId] as const,
    organizationConcurrent:  (orgId: string)                     => ["library", "organization-concurrent", orgId] as const,
    organizationSessions:    (orgId: string)                     => ["library", "organization-sessions", orgId] as const,
    organizationAssignments: (orgId: string)                     => ["library", "organization-assignments", orgId] as const,
    organizationAssignmentCompletions: (assignmentId: string)     => ["library", "organization-assignment-completions", assignmentId] as const,
    organizationAnalytics:   (orgId: string)                     => ["library", "organization-analytics", orgId] as const,
    organizationAuditLog:    (orgId: string)                     => ["library", "organization-audit-log", orgId] as const,
    organizationInvitations: (orgId: string)                     => ["library", "organization-invitations", orgId] as const,
  },
} as const;
