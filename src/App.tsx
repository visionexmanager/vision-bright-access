import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SoundProvider } from "@/contexts/SoundContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AdminRoute } from "@/components/AdminRoute";
import "@/lib/academy/accessibilityPrefs"; // applies stored Academy text-scale/reduce-motion classes on app load
import { AuthGuard } from "@/components/AuthGuard";
import { PageTracker } from "@/components/PageTracker";
import { GameEconomyGate } from "@/components/game/GameEconomyGate";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const VXBazaar = lazy(() => import("./pages/VXBazaar"));
const Services = lazy(() => import("./pages/Services"));
const Academy = lazy(() => import("./pages/Academy"));
const AcademyCourseCatalog = lazy(() => import("./pages/academy/AcademyCourseCatalog"));
const AcademyCourseDetail = lazy(() => import("./pages/academy/AcademyCourseDetail"));
const AcademyLearningPlayer = lazy(() => import("./pages/academy/AcademyLearningPlayer"));
const AcademyLearningTracks = lazy(() => import("./pages/academy/AcademyLearningTracks"));
const AcademyInstructorProfile = lazy(() => import("./pages/academy/AcademyInstructorProfile"));
const AcademyBecomeInstructor = lazy(() => import("./pages/academy/AcademyBecomeInstructor"));
const AcademyInstructorDashboard = lazy(() => import("./pages/academy/AcademyInstructorDashboard"));
const AcademyCourseEditor = lazy(() => import("./pages/academy/AcademyCourseEditor"));
const AcademyLibrary = lazy(() => import("./pages/academy/AcademyLibrary"));
const AcademyResourceViewer = lazy(() => import("./pages/academy/AcademyResourceViewer"));
const AcademyScholarships = lazy(() => import("./pages/academy/AcademyScholarships"));
const AcademyScholarshipDetail = lazy(() => import("./pages/academy/AcademyScholarshipDetail"));
const AcademyUniversities = lazy(() => import("./pages/academy/AcademyUniversities"));
const AcademyUniversityDetail = lazy(() => import("./pages/academy/AcademyUniversityDetail"));
const AcademyGlobalSearch = lazy(() => import("./pages/academy/AcademyGlobalSearch"));
const AcademyCertificates = lazy(() => import("./pages/academy/AcademyCertificates"));
const AcademyCertificateVerify = lazy(() => import("./pages/academy/AcademyCertificateVerify"));
const AcademyAchievements = lazy(() => import("./pages/academy/AcademyAchievements"));
const AcademyMissions = lazy(() => import("./pages/academy/AcademyMissions"));
const AcademyLeaderboard = lazy(() => import("./pages/academy/AcademyLeaderboard"));
const AcademyNotifications = lazy(() => import("./pages/academy/AcademyNotifications"));
const AcademySaved = lazy(() => import("./pages/academy/AcademySaved"));
const AcademyStudyPlanner = lazy(() => import("./pages/academy/AcademyStudyPlanner"));
const AcademyMyCourses = lazy(() => import("./pages/academy/AcademyMyCourses"));
const AcademyMyWork = lazy(() => import("./pages/academy/AcademyMyWork"));
const AcademySettings = lazy(() => import("./pages/academy/AcademySettings"));
const AdminInstructorApplications = lazy(() => import("./pages/admin/AdminInstructorApplications"));
const AdminLibraryResources = lazy(() => import("./pages/admin/AdminLibraryResources"));
const AdminScholarships = lazy(() => import("./pages/admin/AdminScholarships"));
const AdminAcademyHub = lazy(() => import("./pages/admin/AdminAcademyHub"));
const AdminAcademyStudents = lazy(() => import("./pages/admin/AdminAcademyStudents"));
const AdminAcademyGamification = lazy(() => import("./pages/admin/AdminAcademyGamification"));
const AdminAcademyAnalytics = lazy(() => import("./pages/admin/AdminAcademyAnalytics"));
const AdminUniversities = lazy(() => import("./pages/admin/AdminUniversities"));

// Library — books/audiobooks section (Phase 1 architecture prep, distinct from academy/library)
const LibraryHome = lazy(() => import("./pages/library/LibraryHome"));
const LibraryCategories = lazy(() => import("./pages/library/LibraryCategories"));
const LibraryCategoryDetails = lazy(() => import("./pages/library/LibraryCategoryDetails"));
const LibraryBooksExplorer = lazy(() => import("./pages/library/LibraryBooksExplorer"));
const LibraryBookDetails = lazy(() => import("./pages/library/LibraryBookDetails"));
const LibraryReader = lazy(() => import("./pages/library/LibraryReader"));
const LibraryAudiobooks = lazy(() => import("./pages/library/LibraryAudiobooks"));
const LibraryAudiobookPlayer = lazy(() => import("./pages/library/LibraryAudiobookPlayer"));
const LibraryAuthors = lazy(() => import("./pages/library/LibraryAuthors"));
const LibraryAuthorProfile = lazy(() => import("./pages/library/LibraryAuthorProfile"));
const LibrarySearch = lazy(() => import("./pages/library/LibrarySearch"));
const LibraryQuotes = lazy(() => import("./pages/library/LibraryQuotes"));
const LibraryMyLibrary = lazy(() => import("./pages/library/LibraryMyLibrary"));
const LibraryReadingLists = lazy(() => import("./pages/library/LibraryReadingLists"));
const LibraryFavorites = lazy(() => import("./pages/library/LibraryFavorites"));
const LibraryContinueReading = lazy(() => import("./pages/library/LibraryContinueReading"));
const LibraryDownloads = lazy(() => import("./pages/library/LibraryDownloads"));
const LibraryReviews = lazy(() => import("./pages/library/LibraryReviews"));
const LibraryCommunity = lazy(() => import("./pages/library/LibraryCommunity"));
const LibraryDashboard = lazy(() => import("./pages/library/LibraryDashboard"));
const LibraryAdmin = lazy(() => import("./pages/library/LibraryAdmin"));

// Book Marketplace (Phase 10) — public storefront pages, plus one
// personal (AuthGuard) wishlist page.
const LibraryWishlistPage = lazy(() => import("./pages/library/LibraryWishlistPage"));
const LibraryPublisherProfile = lazy(() => import("./pages/library/LibraryPublisherProfile"));
const LibraryCollectionDetail = lazy(() => import("./pages/library/LibraryCollectionDetail"));
const LibrarySeriesDetail = lazy(() => import("./pages/library/LibrarySeriesDetail"));
const LibraryBundleDetail = lazy(() => import("./pages/library/LibraryBundleDetail"));

// Library Author Publishing Studio (Phase 9) — distinct from the reader-side
// pages above; the author-facing dashboard/creation/editor/collaboration
// surface, gated by AuthGuard (not AdminRoute — any signed-in user can
// become an author via the self-service flow).
const LibraryStudioDashboard = lazy(() => import("./pages/library/studio/LibraryStudioDashboard"));
const LibraryBecomeAuthor = lazy(() => import("./pages/library/studio/LibraryBecomeAuthor"));
const LibraryStudioBookWizard = lazy(() => import("./pages/library/studio/LibraryStudioBookWizard"));
const LibraryStudioBookOverview = lazy(() => import("./pages/library/studio/LibraryStudioBookOverview"));
const LibraryStudioEditor = lazy(() => import("./pages/library/studio/LibraryStudioEditor"));
const LibraryStudioAnalytics = lazy(() => import("./pages/library/studio/LibraryStudioAnalytics"));

// Global Digital Library (Phase 11) — public-domain import review + curated
// collections admin (both AdminRoute-gated), and the public knowledge-graph
// navigator (browsing, no auth required — same as authors/categories/etc.).
const LibraryImportReview = lazy(() => import("./pages/library/LibraryImportReview"));
const LibraryCollectionsAdmin = lazy(() => import("./pages/library/LibraryCollectionsAdmin"));
const LibraryKnowledgeGraph = lazy(() => import("./pages/library/LibraryKnowledgeGraph"));
const LibraryKnowledgeGraphEntity = lazy(() => import("./pages/library/LibraryKnowledgeGraphEntity"));

// Knowledge & Research Platform (Phase 14) — knowledge maps, timelines, AI
// semantic search, the multi-book Research Assistant, and the Research
// Workspace (projects/collaboration). Public browsing where the underlying
// data is public (knowledge maps/timelines mirror the Knowledge Graph's own
// public-read rule); personal/collaborative surfaces enforced by RLS.
const LibraryKnowledgeMap = lazy(() => import("./pages/library/LibraryKnowledgeMap"));
const LibraryTimelines = lazy(() => import("./pages/library/LibraryTimelines"));
const LibraryTimelineDetail = lazy(() => import("./pages/library/LibraryTimelineDetail"));
const LibraryAiSearch = lazy(() => import("./pages/library/LibraryAiSearch"));
const LibraryResearchAssistant = lazy(() => import("./pages/library/LibraryResearchAssistant"));
const LibraryResearchAnalysisDetail = lazy(() => import("./pages/library/LibraryResearchAnalysisDetail"));
const LibraryResearchProjects = lazy(() => import("./pages/library/LibraryResearchProjects"));
const LibraryResearchProjectDetail = lazy(() => import("./pages/library/LibraryResearchProjectDetail"));
const LibraryAiInsights = lazy(() => import("./pages/library/LibraryAiInsights"));

// AI Personal Librarian (Phase 15) — a unifying AI companion dashboard tying
// together data from every prior phase (profile, preferences, daily plans,
// goals, recommendations, chat, privacy). All personal, AuthGuard-ed.
const LibraryLibrarian = lazy(() => import("./pages/library/LibraryLibrarian"));
const LibraryLibrarianProfile = lazy(() => import("./pages/library/LibraryLibrarianProfile"));
const LibraryLibrarianChat = lazy(() => import("./pages/library/LibraryLibrarianChat"));
const LibraryLibrarianSummaries = lazy(() => import("./pages/library/LibraryLibrarianSummaries"));
const LibraryLibrarianPrivacy = lazy(() => import("./pages/library/LibraryLibrarianPrivacy"));

// Enterprise & Organization Platform (Phase 17) — multi-tenant orgs (schools/
// universities/companies/government/NGOs/libraries) with member management,
// groups, private resource libraries, granular permissions, licensing,
// learning-management assignments, analytics/reports, and security settings.
// All personal/organizational, AuthGuard-ed.
const LibraryOrganizations = lazy(() => import("./pages/library/LibraryOrganizations"));
const LibraryOrganizationDashboard = lazy(() => import("./pages/library/LibraryOrganizationDashboard"));
const LibraryOrganizationMembers = lazy(() => import("./pages/library/LibraryOrganizationMembers"));
const LibraryOrganizationGroups = lazy(() => import("./pages/library/LibraryOrganizationGroups"));
const LibraryOrganizationResources = lazy(() => import("./pages/library/LibraryOrganizationResources"));
const LibraryOrganizationPermissions = lazy(() => import("./pages/library/LibraryOrganizationPermissions"));
const LibraryOrganizationLicenses = lazy(() => import("./pages/library/LibraryOrganizationLicenses"));
const LibraryOrganizationAssignments = lazy(() => import("./pages/library/LibraryOrganizationAssignments"));
const LibraryOrganizationAnalytics = lazy(() => import("./pages/library/LibraryOrganizationAnalytics"));
const LibraryOrganizationSecurity = lazy(() => import("./pages/library/LibraryOrganizationSecurity"));

// Reading Community (Phase 12) — reader profiles, book clubs, discussions,
// events, and a leaderboard. Public browsing (profiles/clubs respect their
// own visibility/privacy rules server-side), personal actions AuthGuard-ed.
const LibraryReaderProfile = lazy(() => import("./pages/library/LibraryReaderProfile"));
const LibraryClubs = lazy(() => import("./pages/library/LibraryClubs"));
const LibraryClubDetail = lazy(() => import("./pages/library/LibraryClubDetail"));
const LibraryDiscussionTopic = lazy(() => import("./pages/library/LibraryDiscussionTopic"));
const LibraryChallenges = lazy(() => import("./pages/library/LibraryChallenges"));
const LibraryEvents = lazy(() => import("./pages/library/LibraryEvents"));
const LibraryLeaderboard = lazy(() => import("./pages/library/LibraryLeaderboard"));

// Learning Hub (Phase 13) — learning paths, flashcards, quizzes, AI study
// assistant, analytics, and certificates. Certificate verification is
// public (no auth required — anyone with a certificate number can confirm
// authenticity); everything else is personal, AuthGuard-ed.
const LibraryLearningPaths = lazy(() => import("./pages/library/LibraryLearningPaths"));
const LibraryLearningPathDetail = lazy(() => import("./pages/library/LibraryLearningPathDetail"));
const LibraryFlashcards = lazy(() => import("./pages/library/LibraryFlashcards"));
const LibraryFlashcardStudyDeck = lazy(() => import("./pages/library/LibraryFlashcardStudyDeck"));
const LibraryQuizTake = lazy(() => import("./pages/library/LibraryQuizTake"));
const LibraryStudyAssistant = lazy(() => import("./pages/library/LibraryStudyAssistant"));
const LibraryLearningAnalytics = lazy(() => import("./pages/library/LibraryLearningAnalytics"));
const LibraryCertificates = lazy(() => import("./pages/library/LibraryCertificates"));
const LibraryCertificateVerify = lazy(() => import("./pages/library/LibraryCertificateVerify"));

const Content = lazy(() => import("./pages/Content"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Games = lazy(() => import("./pages/Games"));
const VisionexKids = lazy(() => import("./pages/VisionexKids"));
const AccessibleGames = lazy(() => import("./pages/AccessibleGames"));
const ArcadePlayerHub = lazy(() => import("./pages/ArcadePlayerHub"));
const QuizChallenge = lazy(() => import("./pages/QuizChallenge"));
const MemoryGame = lazy(() => import("./pages/MemoryGame"));
const WordPuzzle = lazy(() => import("./pages/WordPuzzle"));
const Visionopoly = lazy(() => import("./pages/games/Visionopoly"));
const AssistiveProducts = lazy(() => import("./pages/AssistiveProducts"));
const BusinessSimulator = lazy(() => import("./pages/BusinessSimulator"));
const SimulationRunner = lazy(() => import("./pages/SimulationRunner"));
const SimulationsSummary = lazy(() => import("./pages/SimulationsSummary"));
const Delivery = lazy(() => import("./pages/Delivery"));
const TripHistory = lazy(() => import("./pages/TripHistory"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));
const BusinessEconomy = lazy(() => import("./pages/BusinessEconomy"));
const NutritionExpert = lazy(() => import("./pages/NutritionExpert"));
const Community = lazy(() => import("./pages/Community"));
const VoiceRoom = lazy(() => import("./pages/community/VoiceRoom"));
const VoiceRooms = lazy(() => import("./pages/community/VoiceRooms"));
const CoinsStore = lazy(() => import("./pages/CoinsStore"));
const News = lazy(() => import("./pages/News"));
const NewsletterPreferences = lazy(() => import("./pages/NewsletterPreferences"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const ProfessionalTools = lazy(() => import("./pages/ProfessionalTools"));
const ToolDetail = lazy(() => import("./pages/ToolDetail"));

const Careers = lazy(() => import("./pages/Careers"));
const CareerDashboard = lazy(() => import("./pages/career/CareerDashboard"));
const AICareerSuite = lazy(() => import("./pages/career/AICareerSuite"));
const EmployerDashboard = lazy(() => import("./pages/career/EmployerDashboard"));
const JobIntelligence = lazy(() => import("./pages/career/JobIntelligence"));
const CareerAgent = lazy(() => import("./pages/career/CareerAgent"));
const CareerNetwork = lazy(() => import("./pages/career/CareerNetwork"));
const CareerCommunity = lazy(() => import("./pages/career/CareerCommunity"));

// New service pages
const CareerHub = lazy(() => import("./pages/services/CareerHub"));
const MusicConservatory = lazy(() => import("./pages/services/MusicConservatory"));
const GlobalStudio = lazy(() => import("./pages/services/GlobalStudio"));
const WebDesign = lazy(() => import("./pages/services/WebDesign"));
const DigitalMarketing = lazy(() => import("./pages/services/DigitalMarketing"));
const ImportPurchasing = lazy(() => import("./pages/services/ImportPurchasing"));
const TechConsulting = lazy(() => import("./pages/services/TechConsulting"));
const TrainingService = lazy(() => import("./pages/services/Training"));
const HairCare = lazy(() => import("./pages/services/HairCare"));
const LegalAdvisor = lazy(() => import("./pages/services/LegalAdvisor"));
const MedicalSupport = lazy(() => import("./pages/services/MedicalSupport"));
const Psychology = lazy(() => import("./pages/services/Psychology"));
const SkinCareExpert = lazy(() => import("./pages/services/SkinCareExpert"));
const SocialGuide = lazy(() => import("./pages/services/SocialGuide"));
const SportsCoach = lazy(() => import("./pages/services/SportsCoach"));
const TravelAgency = lazy(() => import("./pages/services/TravelAgency"));
const RadarAI = lazy(() => import("./pages/services/RadarAI"));
const EducationalEmpire = lazy(() => import("./pages/services/EducationalEmpire"));
const EmpathyOasis = lazy(() => import("./pages/services/EmpathyOasis"));
const OCRScan = lazy(() => import("./pages/services/OCRScan"));
const FileStudio = lazy(() => import("./pages/services/FileStudio"));
const LiveTV          = lazy(() => import("./pages/services/LiveTV"));
const LiveTVWatch     = lazy(() => import("./pages/services/LiveTVWatch"));
const LiveTVSubscribe = lazy(() => import("./pages/services/LiveTVSubscribe"));
const LiveTVFavorites = lazy(() => import("./pages/services/LiveTVFavorites"));
const LiveTVSearch    = lazy(() => import("./pages/services/LiveTVSearch"));
const LiveTVPlaylists = lazy(() => import("./pages/services/LiveTVPlaylists"));
const StreamingGuide = lazy(() => import("./pages/services/StreamingGuide"));
const LiveRadio = lazy(() => import("./pages/services/LiveRadio"));
const LiveRadioListen = lazy(() => import("./pages/services/LiveRadioListen"));
const LiveRadioSubscribe = lazy(() => import("./pages/services/LiveRadioSubscribe"));

// AI Media Studio
const AIMediaStudio = lazy(() => import("./pages/services/ai-media-studio/index"));
const AIMediaStudioProjects = lazy(() => import("./pages/services/ai-media-studio/Projects"));
const AIMediaStudioAssets = lazy(() => import("./pages/services/ai-media-studio/Assets"));
const AIMediaStudioTemplates = lazy(() => import("./pages/services/ai-media-studio/Templates"));
const AIMediaStudioSettings = lazy(() => import("./pages/services/ai-media-studio/Settings"));
const AIMediaStudioHelp = lazy(() => import("./pages/services/ai-media-studio/Help"));
const AIMediaStudioSpeech = lazy(() => import("./pages/services/ai-media-studio/SpeechStudio"));
const AIMediaStudioVoice  = lazy(() => import("./pages/services/ai-media-studio/VoiceStudio"));
const AIMediaStudioVideo       = lazy(() => import("./pages/services/ai-media-studio/VideoStudio"));
const AIMediaStudioProviderHub  = lazy(() => import("./pages/services/ai-media-studio/ProviderHub"));
const AIMediaStudioBilling      = lazy(() => import("./pages/services/ai-media-studio/Billing"));
const AIMediaStudioImage        = lazy(() => import("./pages/services/ai-media-studio/ImageStudio"));
const AIMediaStudioDiagnostics  = lazy(() => import("./pages/services/ai-media-studio/Diagnostics"));
const AIMediaStudioDocument     = lazy(() => import("./pages/services/ai-media-studio/DocumentStudio"));
const AIMediaStudioTextTools    = lazy(() => import("./pages/services/ai-media-studio/TextToolsStudio"));

// New game pages
const Hangman = lazy(() => import("./pages/games/Hangman"));
const Dominoes = lazy(() => import("./pages/games/Dominoes"));
const FarkleGame = lazy(() => import("./pages/games/FarkleGame"));
const JungleSurvival = lazy(() => import("./pages/games/JungleSurvival"));
const StarChef = lazy(() => import("./pages/games/StarChef"));
const UnoUltra = lazy(() => import("./pages/games/UnoUltra"));
const NeonBreach = lazy(() => import("./pages/games/NeonBreach"));
const LogiQuest = lazy(() => import("./pages/games/LogiQuest"));
const TradeTycoon = lazy(() => import("./pages/games/TradeTycoon"));
const TacticalStrike = lazy(() => import("./pages/games/TacticalStrike"));
const Briscola = lazy(() => import("./pages/games/Briscola"));
const Card99 = lazy(() => import("./pages/games/Card99"));
const DreamHome = lazy(() => import("./pages/games/DreamHome"));
const LaptopTechMaster = lazy(() => import("./pages/games/LaptopTechMaster"));
const MusicEarMaster = lazy(() => import("./pages/games/MusicEarMaster"));
const FashionDesigner = lazy(() => import("./pages/games/FashionDesigner"));
const VelocityXRacing = lazy(() => import("./pages/games/VelocityXRacing"));
const Akinator = lazy(() => import("./pages/games/Akinator"));
const ArcadeEconomy = lazy(() => import("./pages/ArcadeEconomy"));

// ── Visionex Finance ──────────────────────────────────────────────────────────
const FinanceDashboard   = lazy(() => import("./pages/finance/FinanceDashboard"));
const FinanceMarkets     = lazy(() => import("./pages/finance/Markets"));
const FinanceStocks      = lazy(() => import("./pages/finance/Stocks"));
const FinanceCurrencies  = lazy(() => import("./pages/finance/Currencies"));
const FinanceCommodities = lazy(() => import("./pages/finance/Commodities"));
const FinancePortfolio   = lazy(() => import("./pages/finance/Portfolio"));
const FinanceWatchlist   = lazy(() => import("./pages/finance/Watchlist"));
const FinanceAIAnalyst   = lazy(() => import("./pages/finance/AIAnalyst"));
const FinanceCalendar    = lazy(() => import("./pages/finance/EconomicCalendar"));
const FinanceNews        = lazy(() => import("./pages/finance/MarketNews"));
const FinanceAffiliate   = lazy(() => import("./pages/finance/AffiliateCenter"));
const FinanceBrokers     = lazy(() => import("./pages/finance/BrokerComparison"));
const FinanceAcademy     = lazy(() => import("./pages/finance/FinanceAcademy"));

// Legal pages
const LegalCenter = lazy(() => import("./pages/legal/LegalCenter"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminInfra     = lazy(() => import("./pages/admin/AdminInfra"));
const AdminNews = lazy(() => import("./pages/admin/AdminNews"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminRequests = lazy(() => import("./pages/admin/AdminRequests"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSubscribers = lazy(() => import("./pages/admin/AdminSubscribers"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminEmails = lazy(() => import("./pages/admin/AdminEmails"));
const AdminDatabase = lazy(() => import("./pages/admin/AdminDatabase"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminVX   = lazy(() => import("./pages/admin/AdminVX"));
const AdminVXCoinOrders = lazy(() => import("./pages/admin/AdminVXCoinOrders"));
const AdminSimulations = lazy(() => import("./pages/admin/AdminSimulations"));
const AdminBazaar = lazy(() => import("./pages/admin/AdminBazaar"));
const AdminTV = lazy(() => import("./pages/admin/AdminTV"));
const AdminRadio = lazy(() => import("./pages/admin/AdminRadio"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminArcadeEconomy = lazy(() => import("./pages/admin/AdminArcadeEconomy"));

// VisionKids — accessibility-first kids' hub, independent layout/nav from the rest of the site.
const VisionKidsLayout = lazy(() => import("./features/visionkids/layouts/VisionKidsLayout"));
const VisionKidsHome = lazy(() => import("./features/visionkids/pages/VisionKidsHome"));
const VisionKidsSettings = lazy(() => import("./features/visionkids/pages/VisionKidsSettings"));
const VisionKidsSection = lazy(() => import("./features/visionkids/pages/VisionKidsSection"));

// VisionKids Phase 2 — Smart Stories Library
const StoriesHome = lazy(() => import("./features/visionkids/pages/stories/StoriesHome"));
const StoryCategories = lazy(() => import("./features/visionkids/pages/stories/StoryCategories"));
const StoryBrowse = lazy(() => import("./features/visionkids/pages/stories/StoryBrowse"));
const StoryDetails = lazy(() => import("./features/visionkids/pages/stories/StoryDetails"));
const StoryReader = lazy(() => import("./features/visionkids/pages/stories/StoryReader"));
const StoryAudioPlayer = lazy(() => import("./features/visionkids/pages/stories/StoryAudioPlayer"));
const StoryQuizPage = lazy(() => import("./features/visionkids/pages/stories/StoryQuizPage"));
const StoryFavorites = lazy(() => import("./features/visionkids/pages/stories/StoryFavorites"));
const StoryDownloads = lazy(() => import("./features/visionkids/pages/stories/StoryDownloads"));
const StoryContinueReading = lazy(() => import("./features/visionkids/pages/stories/StoryContinueReading"));
const StoryHistory = lazy(() => import("./features/visionkids/pages/stories/StoryHistory"));
const StoryRecommended = lazy(() => import("./features/visionkids/pages/stories/StoryRecommended"));
const AiStories = lazy(() => import("./features/visionkids/pages/stories/AiStories"));
const AiStoryCreate = lazy(() => import("./features/visionkids/pages/stories/AiStoryCreate"));
const AiStoryDetail = lazy(() => import("./features/visionkids/pages/stories/AiStoryDetail"));

// VisionKids Phase 3 — Educational Games Platform
const GamesHome = lazy(() => import("./features/visionkids/pages/games/GamesHome"));
const GameCategories = lazy(() => import("./features/visionkids/pages/games/GameCategories"));
const GameBrowse = lazy(() => import("./features/visionkids/pages/games/GameBrowse"));
const GameDetails = lazy(() => import("./features/visionkids/pages/games/GameDetails"));
const GamePlay = lazy(() => import("./features/visionkids/pages/games/GamePlay"));
const RecentlyPlayed = lazy(() => import("./features/visionkids/pages/games/RecentlyPlayed"));
const GameFavorites = lazy(() => import("./features/visionkids/pages/games/GameFavorites"));
const Achievements = lazy(() => import("./features/visionkids/pages/games/Achievements"));
const GamesLeaderboard = lazy(() => import("./features/visionkids/pages/games/Leaderboard"));
const DailyChallenges = lazy(() => import("./features/visionkids/pages/games/DailyChallenges"));
const WeeklyChallenges = lazy(() => import("./features/visionkids/pages/games/WeeklyChallenges"));
const MultiplayerLobby = lazy(() => import("./features/visionkids/pages/games/MultiplayerLobby"));
const MultiplayerRoomView = lazy(() => import("./features/visionkids/pages/games/MultiplayerRoomView"));
const GameProfile = lazy(() => import("./features/visionkids/pages/games/GameProfile"));

// VisionKids Phase 4 — Academy
const AcademyHome = lazy(() => import("./features/visionkids/pages/academy/AcademyHome"));
const AcademySubjects = lazy(() => import("./features/visionkids/pages/academy/Subjects"));
const SubjectCourses = lazy(() => import("./features/visionkids/pages/academy/SubjectCourses"));
const CourseDetail = lazy(() => import("./features/visionkids/pages/academy/CourseDetail"));
const LessonPlayer = lazy(() => import("./features/visionkids/pages/academy/LessonPlayer"));
const AcademyHomework = lazy(() => import("./features/visionkids/pages/academy/Homework"));
const AcademyProjects = lazy(() => import("./features/visionkids/pages/academy/Projects"));
const ProjectSubmit = lazy(() => import("./features/visionkids/pages/academy/ProjectSubmit"));
const AcademyExams = lazy(() => import("./features/visionkids/pages/academy/Exams"));
const KidsAcademyCertificates = lazy(() => import("./features/visionkids/pages/academy/Certificates"));
const CertificateVerify = lazy(() => import("./features/visionkids/pages/academy/CertificateVerify"));
const ParentsDashboard = lazy(() => import("./features/visionkids/pages/academy/ParentsDashboard"));
const TeacherDashboard = lazy(() => import("./features/visionkids/pages/academy/TeacherDashboard"));
const TeacherCourseManage = lazy(() => import("./features/visionkids/pages/academy/TeacherCourseManage"));
const LearningAnalytics = lazy(() => import("./features/visionkids/pages/academy/LearningAnalytics"));
const LearningPath = lazy(() => import("./features/visionkids/pages/academy/LearningPath"));
const AcademyDownloads = lazy(() => import("./features/visionkids/pages/academy/Downloads"));

// VisionKids Phase 5 — AI Creative Studio
const StudioHome = lazy(() => import("./features/visionkids/pages/studio/StudioHome"));
const DrawingStudio = lazy(() => import("./features/visionkids/pages/studio/DrawingStudio"));
const CharacterBuilder = lazy(() => import("./features/visionkids/pages/studio/CharacterBuilder"));
const StickerMaker = lazy(() => import("./features/visionkids/pages/studio/StickerMaker"));
const MusicStudio = lazy(() => import("./features/visionkids/pages/studio/MusicStudio"));
const VoiceStudio = lazy(() => import("./features/visionkids/pages/studio/VoiceStudio"));
const CartoonCreator = lazy(() => import("./features/visionkids/pages/studio/CartoonCreator"));
const ComicCreator = lazy(() => import("./features/visionkids/pages/studio/ComicCreator"));
const BookCreator = lazy(() => import("./features/visionkids/pages/studio/BookCreator"));
const VideoCreator = lazy(() => import("./features/visionkids/pages/studio/VideoCreator"));
const StudioGallery = lazy(() => import("./features/visionkids/pages/studio/StudioGallery"));
const StudioTemplates = lazy(() => import("./features/visionkids/pages/studio/StudioTemplates"));
const CreativeChallenges = lazy(() => import("./features/visionkids/pages/studio/CreativeChallenges"));
const MyProjects = lazy(() => import("./features/visionkids/pages/studio/MyProjects"));

// VisionKids Phase 6 — Explorer
const ExplorerHome = lazy(() => import("./features/visionkids/pages/explorer/ExplorerHome"));
const VirtualWorld = lazy(() => import("./features/visionkids/pages/explorer/VirtualWorld"));
const ExplorerWorldListPage = lazy(() => import("./features/visionkids/pages/explorer/WorldListPage"));
const ExplorerLocationDetailPage = lazy(() => import("./features/visionkids/pages/explorer/LocationDetailPage"));
const ExplorerLocationQuizPage = lazy(() => import("./features/visionkids/pages/explorer/LocationQuizPage"));
const ExplorerPassport = lazy(() => import("./features/visionkids/pages/explorer/ExplorerPassport"));
const SpaceMission = lazy(() => import("./features/visionkids/pages/explorer/SpaceMission"));
const CityBuilder = lazy(() => import("./features/visionkids/pages/explorer/CityBuilder"));
const FarmSimulator = lazy(() => import("./features/visionkids/pages/explorer/FarmSimulator"));
const EcoWorld = lazy(() => import("./features/visionkids/pages/explorer/EcoWorld"));

// VisionKids Phase 7 — Social & Parents Hub
const CommunityHome = lazy(() => import("./features/visionkids/pages/social/CommunityHome"));
const SocialFriends = lazy(() => import("./features/visionkids/pages/social/Friends"));
const SocialChallengesHub = lazy(() => import("./features/visionkids/pages/social/ChallengesHub"));
const SocialNotifications = lazy(() => import("./features/visionkids/pages/social/Notifications"));
const SocialReports = lazy(() => import("./features/visionkids/pages/social/Reports"));
const ClubListPage = lazy(() => import("./features/visionkids/pages/social/ClubListPage"));
const ClubDetailPage = lazy(() => import("./features/visionkids/pages/social/ClubDetailPage"));
const ClubQuizPage = lazy(() => import("./features/visionkids/pages/social/ClubQuizPage"));
const SafeChatHome = lazy(() => import("./features/visionkids/pages/social/SafeChatHome"));
const ChatThread = lazy(() => import("./features/visionkids/pages/social/ChatThread"));
const VoiceRoomLobby = lazy(() => import("./features/visionkids/pages/social/VoiceRoomLobby"));
const VoiceRoomLive = lazy(() => import("./features/visionkids/pages/social/VoiceRoomLive"));
const SocialSettings = lazy(() => import("./features/visionkids/pages/social/SocialSettings"));
const ModerationPanel = lazy(() => import("./features/visionkids/pages/social/ModerationPanel"));
const FamilyAccounts = lazy(() => import("./features/visionkids/pages/social/FamilyAccounts"));
const SocialParentsDashboard = lazy(() => import("./features/visionkids/pages/social/ParentsDashboard"));
const SocialActivityTimeline = lazy(() => import("./features/visionkids/pages/social/ActivityTimeline"));
const SocialParentSettings = lazy(() => import("./features/visionkids/pages/social/ParentSettings"));

// VisionKids Phase 8 — Live Events & Universe
const EventsHome = lazy(() => import("./features/visionkids/pages/events/EventsHome"));
const EventListPage = lazy(() => import("./features/visionkids/pages/events/EventListPage"));
const EventsCalendar = lazy(() => import("./features/visionkids/pages/events/Calendar"));
const MyEvents = lazy(() => import("./features/visionkids/pages/events/MyEvents"));
const EventNotifications = lazy(() => import("./features/visionkids/pages/events/EventNotifications"));
const EventDetails = lazy(() => import("./features/visionkids/pages/events/EventDetails"));
const EventRegistration = lazy(() => import("./features/visionkids/pages/events/Registration"));
const LiveEventRoom = lazy(() => import("./features/visionkids/pages/events/LiveEventRoom"));
const ReplayLibrary = lazy(() => import("./features/visionkids/pages/events/ReplayLibrary"));
const ReplayPlayer = lazy(() => import("./features/visionkids/pages/events/ReplayPlayer"));
const EventsRewardsCenter = lazy(() => import("./features/visionkids/pages/events/RewardsCenter"));
const EventCertificates = lazy(() => import("./features/visionkids/pages/events/EventCertificates"));
const UniverseMap = lazy(() => import("./features/visionkids/pages/events/UniverseMap"));
const UniverseCityDetail = lazy(() => import("./features/visionkids/pages/events/CityDetail"));

// VisionKids Phase 9 — Talent Hub & Future Skills
const TalentHubHome = lazy(() => import("./features/visionkids/pages/talent/TalentHubHome"));
const TalentAssessment = lazy(() => import("./features/visionkids/pages/talent/TalentAssessment"));
const MyTalents = lazy(() => import("./features/visionkids/pages/talent/MyTalents"));
const SkillTree = lazy(() => import("./features/visionkids/pages/talent/SkillTree"));
const TalentFutureSkills = lazy(() => import("./features/visionkids/pages/talent/FutureSkills"));
const FutureSkillDetail = lazy(() => import("./features/visionkids/pages/talent/FutureSkillDetail"));
const TalentTrackDetail = lazy(() => import("./features/visionkids/pages/talent/TrackDetail"));
const TalentModuleDetail = lazy(() => import("./features/visionkids/pages/talent/ModuleDetail"));
const TalentPortfolio = lazy(() => import("./features/visionkids/pages/talent/Portfolio"));
const TalentAchievements = lazy(() => import("./features/visionkids/pages/talent/TalentAchievements"));
const CareerExplorer = lazy(() => import("./features/visionkids/pages/talent/CareerExplorer"));
const CareerDetail = lazy(() => import("./features/visionkids/pages/talent/CareerDetail"));
const TalentMentors = lazy(() => import("./features/visionkids/pages/talent/Mentors"));

// VisionKids Phase 10 — Health & Wellness Hub
const HealthHome = lazy(() => import("./features/visionkids/pages/wellness/HealthHome"));
const DailyRoutine = lazy(() => import("./features/visionkids/pages/wellness/DailyRoutine"));
const HealthyHabits = lazy(() => import("./features/visionkids/pages/wellness/HealthyHabits"));
const Nutrition = lazy(() => import("./features/visionkids/pages/wellness/Nutrition"));
const ExerciseCenter = lazy(() => import("./features/visionkids/pages/wellness/ExerciseCenter"));
const SleepTracker = lazy(() => import("./features/visionkids/pages/wellness/SleepTracker"));
const MoodJournal = lazy(() => import("./features/visionkids/pages/wellness/MoodJournal"));
const Mindfulness = lazy(() => import("./features/visionkids/pages/wellness/Mindfulness"));
const SafetyAcademy = lazy(() => import("./features/visionkids/pages/wellness/SafetyAcademy"));
const FirstAidKids = lazy(() => import("./features/visionkids/pages/wellness/FirstAidKids"));
const SmartCompanion = lazy(() => import("./features/visionkids/pages/wellness/SmartCompanion"));
const HealthyChallenges = lazy(() => import("./features/visionkids/pages/wellness/HealthyChallenges"));
const EmergencyGuide = lazy(() => import("./features/visionkids/pages/wellness/EmergencyGuide"));
const WellnessRewards = lazy(() => import("./features/visionkids/pages/wellness/WellnessRewards"));
const WellnessAccessibility = lazy(() => import("./features/visionkids/pages/wellness/WellnessAccessibility"));
const WellnessLessonDetail = lazy(() => import("./features/visionkids/pages/wellness/WellnessLessonDetail"));

// VisionKids Phase 11 — STEM & Innovation Center
const StemHome = lazy(() => import("./features/visionkids/pages/stem/StemHome"));
const ScienceLab = lazy(() => import("./features/visionkids/pages/stem/ScienceLab"));
const PhysicsLab = lazy(() => import("./features/visionkids/pages/stem/PhysicsLab"));
const ChemistryLab = lazy(() => import("./features/visionkids/pages/stem/ChemistryLab"));
const BiologyLab = lazy(() => import("./features/visionkids/pages/stem/BiologyLab"));
const MathLab = lazy(() => import("./features/visionkids/pages/stem/MathLab"));
const EngineeringLab = lazy(() => import("./features/visionkids/pages/stem/EngineeringLab"));
const ElectronicsLab = lazy(() => import("./features/visionkids/pages/stem/ElectronicsLab"));
const SpaceEngineering = lazy(() => import("./features/visionkids/pages/stem/SpaceEngineering"));
const RoboticsWorkshop = lazy(() => import("./features/visionkids/pages/stem/RoboticsWorkshop"));
const Design3DStudio = lazy(() => import("./features/visionkids/pages/stem/Design3DStudio"));
const StemExperimentDetail = lazy(() => import("./features/visionkids/pages/stem/ExperimentDetail"));
const InnovationChallenges = lazy(() => import("./features/visionkids/pages/stem/InnovationChallenges"));
const InnovationChallengeDetail = lazy(() => import("./features/visionkids/pages/stem/InnovationChallengeDetail"));
const InventorGallery = lazy(() => import("./features/visionkids/pages/stem/InventorGallery"));
const ResearchCenter = lazy(() => import("./features/visionkids/pages/stem/ResearchCenter"));
const ResearchArticlePage = lazy(() => import("./features/visionkids/pages/stem/ResearchArticle"));
const StemRewards = lazy(() => import("./features/visionkids/pages/stem/StemRewards"));
const StemAccessibility = lazy(() => import("./features/visionkids/pages/stem/StemAccessibility"));

// VisionKids Phase 12 — VisionKids World
const WorldHome = lazy(() => import("./features/visionkids/pages/world/WorldHome"));
const WorldInteractiveMap = lazy(() => import("./features/visionkids/pages/world/InteractiveMap"));
const WorldMyHome = lazy(() => import("./features/visionkids/pages/world/MyHome"));
const WorldDreamCity = lazy(() => import("./features/visionkids/pages/world/DreamCity"));
const WorldAdventureIslands = lazy(() => import("./features/visionkids/pages/world/AdventureIslands"));
const WorldScienceCity = lazy(() => import("./features/visionkids/pages/world/ScienceCity"));
const WorldReadingVillage = lazy(() => import("./features/visionkids/pages/world/ReadingVillage"));
const WorldArtDistrict = lazy(() => import("./features/visionkids/pages/world/ArtDistrict"));
const WorldMusicTown = lazy(() => import("./features/visionkids/pages/world/MusicTown"));
const WorldSportsArena = lazy(() => import("./features/visionkids/pages/world/SportsArena"));
const WorldSpacePort = lazy(() => import("./features/visionkids/pages/world/SpacePort"));
const WorldOceanWorld = lazy(() => import("./features/visionkids/pages/world/OceanWorld"));
const WorldNaturePark = lazy(() => import("./features/visionkids/pages/world/NaturePark"));
const WorldEventsPlaza = lazy(() => import("./features/visionkids/pages/world/EventsPlaza"));
const WorldMarketplace = lazy(() => import("./features/visionkids/pages/world/Marketplace"));
const WorldTransportation = lazy(() => import("./features/visionkids/pages/world/Transportation"));
const WorldWeatherCenter = lazy(() => import("./features/visionkids/pages/world/WeatherCenter"));
const WorldPassport = lazy(() => import("./features/visionkids/pages/world/WorldPassport"));
const WorldAccessibility = lazy(() => import("./features/visionkids/pages/world/WorldAccessibility"));
const WorldRegionRoute = lazy(() => import("./features/visionkids/pages/world/RegionRoute"));

// VisionKids Phase 13 — Creator & Education Marketplace
const MarketHome = lazy(() => import("./features/visionkids/pages/market/MarketplaceHome"));
const MarketDiscover = lazy(() => import("./features/visionkids/pages/market/Discover"));
const MarketProductDetail = lazy(() => import("./features/visionkids/pages/market/ProductDetail"));
const MarketCourses = lazy(() => import("./features/visionkids/pages/market/Courses"));
const MarketBooks = lazy(() => import("./features/visionkids/pages/market/Books"));
const MarketGames = lazy(() => import("./features/visionkids/pages/market/Games"));
const MarketWorksheets = lazy(() => import("./features/visionkids/pages/market/Worksheets"));
const MarketTemplates = lazy(() => import("./features/visionkids/pages/market/Templates"));
const MarketMusic = lazy(() => import("./features/visionkids/pages/market/Music"));
const MarketVideos = lazy(() => import("./features/visionkids/pages/market/Videos"));
const MarketModels3D = lazy(() => import("./features/visionkids/pages/market/Models3D"));
const MarketAIPrompts = lazy(() => import("./features/visionkids/pages/market/AIPrompts"));
const MarketBundles = lazy(() => import("./features/visionkids/pages/market/Bundles"));
const MarketOrders = lazy(() => import("./features/visionkids/pages/market/Orders"));
const MarketWishlist = lazy(() => import("./features/visionkids/pages/market/Wishlist"));
const MarketCreatorDashboard = lazy(() => import("./features/visionkids/pages/market/CreatorDashboard"));
const MarketTeacherDashboard = lazy(() => import("./features/visionkids/pages/market/TeacherDashboard"));
const MarketPublisherDashboard = lazy(() => import("./features/visionkids/pages/market/PublisherDashboard"));
const MarketDeveloperDashboard = lazy(() => import("./features/visionkids/pages/market/DeveloperDashboard"));
const MarketCreatorAnalytics = lazy(() => import("./features/visionkids/pages/market/CreatorAnalytics"));
const MarketCreatorVerification = lazy(() => import("./features/visionkids/pages/market/CreatorVerification"));
const MarketModerationQueue = lazy(() => import("./features/visionkids/pages/market/ModerationQueue"));
const MarketAccessibility = lazy(() => import("./features/visionkids/pages/market/MarketAccessibility"));

// VisionKids Phase 14 — Platform Core & Plugin System
const PlatformHub = lazy(() => import("./features/visionkids/pages/platform/PlatformHub"));
const PlatformMarketplace = lazy(() => import("./features/visionkids/pages/platform/PluginMarketplace"));
const PlatformMyPlugins = lazy(() => import("./features/visionkids/pages/platform/MyPlugins"));
const PlatformDashboard = lazy(() => import("./features/visionkids/pages/platform/WidgetDashboard"));
const PlatformThemes = lazy(() => import("./features/visionkids/pages/platform/ThemeGallery"));
const PlatformSettings = lazy(() => import("./features/visionkids/pages/platform/PlatformSettings"));
const PlatformNotifications = lazy(() => import("./features/visionkids/pages/platform/NotificationCenter"));
const PlatformAnalytics = lazy(() => import("./features/visionkids/pages/platform/PlatformAnalytics"));
const PlatformAccessibility = lazy(() => import("./features/visionkids/pages/platform/PlatformAccessibility"));

// VisionKids Phase 15 — Enterprise & School Ecosystem
const EnterpriseHome = lazy(() => import("./features/visionkids/pages/enterprise/EnterpriseHome"));
const EntSchoolsPortal = lazy(() => import("./features/visionkids/pages/enterprise/SchoolsPortal"));
const EntSchoolDashboard = lazy(() => import("./features/visionkids/pages/enterprise/SchoolDashboard"));
const EntClassrooms = lazy(() => import("./features/visionkids/pages/enterprise/Classrooms"));
const EntStudents = lazy(() => import("./features/visionkids/pages/enterprise/Students"));
const EntTeachers = lazy(() => import("./features/visionkids/pages/enterprise/Teachers"));
const EntParents = lazy(() => import("./features/visionkids/pages/enterprise/Parents"));
const EntAttendance = lazy(() => import("./features/visionkids/pages/enterprise/Attendance"));
const EntAssignments = lazy(() => import("./features/visionkids/pages/enterprise/Assignments"));
const EntTimetable = lazy(() => import("./features/visionkids/pages/enterprise/Timetable"));
const EntExams = lazy(() => import("./features/visionkids/pages/enterprise/Exams"));
const EntCertificates = lazy(() => import("./features/visionkids/pages/enterprise/Certificates"));
const EntCertificateVerify = lazy(() => import("./features/visionkids/pages/enterprise/CertificateVerify"));
const EntResourceCenter = lazy(() => import("./features/visionkids/pages/enterprise/ResourceCenter"));
const EntCommunication = lazy(() => import("./features/visionkids/pages/enterprise/CommunicationCenter"));
const EntReports = lazy(() => import("./features/visionkids/pages/enterprise/Reports"));
const EntAnalytics = lazy(() => import("./features/visionkids/pages/enterprise/Analytics"));
const EntOrgSettings = lazy(() => import("./features/visionkids/pages/enterprise/OrganizationSettings"));
const EntAccessibility = lazy(() => import("./features/visionkids/pages/enterprise/EnterpriseAccessibility"));

// VisionKids Phase 16 — AI Operations & Quality Platform (admin-gated)
const OpsDashboard = lazy(() => import("./features/visionkids/pages/ops/OperationsDashboard"));
const OpsSystemHealth = lazy(() => import("./features/visionkids/pages/ops/SystemHealth"));
const OpsAIMonitoring = lazy(() => import("./features/visionkids/pages/ops/AIMonitoring"));
const OpsContentReview = lazy(() => import("./features/visionkids/pages/ops/ContentReview"));
const OpsAccessibility = lazy(() => import("./features/visionkids/pages/ops/AccessibilityCenter"));
const OpsPerformance = lazy(() => import("./features/visionkids/pages/ops/PerformanceCenter"));
const OpsErrors = lazy(() => import("./features/visionkids/pages/ops/ErrorCenter"));
const OpsSecurity = lazy(() => import("./features/visionkids/pages/ops/SecurityCenter"));
const OpsReleases = lazy(() => import("./features/visionkids/pages/ops/ReleaseManager"));
const OpsAudit = lazy(() => import("./features/visionkids/pages/ops/AuditCenter"));
const OpsTesting = lazy(() => import("./features/visionkids/pages/ops/TestingCenter"));
const OpsLogs = lazy(() => import("./features/visionkids/pages/ops/LogsExplorer"));
const OpsInsights = lazy(() => import("./features/visionkids/pages/ops/AIInsights"));
const OpsIncidents = lazy(() => import("./features/visionkids/pages/ops/IncidentCenter"));
const OpsMaintenance = lazy(() => import("./features/visionkids/pages/ops/MaintenanceMode"));

// VisionKids Phase 17 — Economy & Sustainability
const EconomyHome = lazy(() => import("./features/visionkids/pages/economy/EconomyHome"));
const EconMembershipPlans = lazy(() => import("./features/visionkids/pages/economy/MembershipPlans"));
const EconFamilyPlans = lazy(() => import("./features/visionkids/pages/economy/FamilyPlans"));
const EconSchoolPlans = lazy(() => import("./features/visionkids/pages/economy/SchoolPlans"));
const EconNGOPlans = lazy(() => import("./features/visionkids/pages/economy/NGOPlans"));
const EconWallet = lazy(() => import("./features/visionkids/pages/economy/CoinsWallet"));
const EconRewards = lazy(() => import("./features/visionkids/pages/economy/RewardsCenter"));
const EconRedeem = lazy(() => import("./features/visionkids/pages/economy/RedeemCenter"));
const EconGifts = lazy(() => import("./features/visionkids/pages/economy/GiftCenter"));
const EconSubscriptions = lazy(() => import("./features/visionkids/pages/economy/SubscriptionManagement"));
const EconInvoices = lazy(() => import("./features/visionkids/pages/economy/Invoices"));
const EconDonate = lazy(() => import("./features/visionkids/pages/economy/DonationCenter"));
const EconPartners = lazy(() => import("./features/visionkids/pages/economy/PartnerCenter"));
const EconCreatorRevenue = lazy(() => import("./features/visionkids/pages/economy/CreatorRevenue"));
const EconReports = lazy(() => import("./features/visionkids/pages/economy/FinancialReports"));
const EconAccessibility = lazy(() => import("./features/visionkids/pages/economy/EconomyAccessibility"));

// VisionKids Phase 18 — Everywhere (Multi-Platform & Offline)
const EverywhereHome = lazy(() => import("./features/visionkids/pages/everywhere/EverywhereHome"));
const EwMyDevices = lazy(() => import("./features/visionkids/pages/everywhere/MyDevices"));
const EwDownloads = lazy(() => import("./features/visionkids/pages/everywhere/DownloadManager"));
const EwOffline = lazy(() => import("./features/visionkids/pages/everywhere/OfflineCenter"));
const EwConnection = lazy(() => import("./features/visionkids/pages/everywhere/ConnectionSettings"));
const EwTvMode = lazy(() => import("./features/visionkids/pages/everywhere/TvMode"));
const EwAccessibility = lazy(() => import("./features/visionkids/pages/everywhere/EverywhereAccessibility"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
  },
});

function PageLoader() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label={t("app.loadingPage")}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
    </div>
  );
}

// Resets the per-page error boundary on every navigation
function AppRoutes() {
  const location = useLocation();
  return (
    <PageErrorBoundary routeKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <PageTracker />
        <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/bazaar" element={<VXBazaar />} />
                    <Route path="/marketplace" element={<VXBazaar />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/academy" element={<AuthGuard><Academy /></AuthGuard>} />
                    <Route path="/academy/courses" element={<AuthGuard><AcademyCourseCatalog /></AuthGuard>} />
                    <Route path="/academy/courses/:courseId" element={<AuthGuard><AcademyCourseDetail /></AuthGuard>} />
                    <Route path="/academy/courses/:courseId/learn/:lessonId" element={<AuthGuard><AcademyLearningPlayer /></AuthGuard>} />
                    <Route path="/academy/paths" element={<AuthGuard><AcademyLearningTracks /></AuthGuard>} />
                    <Route path="/academy/instructors/:instructorId" element={<AuthGuard><AcademyInstructorProfile /></AuthGuard>} />
                    <Route path="/academy/instructor/apply" element={<AuthGuard><AcademyBecomeInstructor /></AuthGuard>} />
                    <Route path="/academy/instructor/dashboard" element={<AuthGuard><AcademyInstructorDashboard /></AuthGuard>} />
                    <Route path="/academy/instructor/courses/new" element={<AuthGuard><AcademyCourseEditor /></AuthGuard>} />
                    <Route path="/academy/instructor/courses/:courseId/edit" element={<AuthGuard><AcademyCourseEditor /></AuthGuard>} />
                    <Route path="/academy/library" element={<AuthGuard><AcademyLibrary /></AuthGuard>} />
                    <Route path="/academy/library/:resourceId" element={<AuthGuard><AcademyResourceViewer /></AuthGuard>} />
                    <Route path="/academy/scholarships" element={<AuthGuard><AcademyScholarships /></AuthGuard>} />
                    <Route path="/academy/scholarships/:scholarshipId" element={<AuthGuard><AcademyScholarshipDetail /></AuthGuard>} />
                    <Route path="/academy/universities" element={<AuthGuard><AcademyUniversities /></AuthGuard>} />
                    <Route path="/academy/universities/:universityId" element={<AuthGuard><AcademyUniversityDetail /></AuthGuard>} />
                    <Route path="/academy/search" element={<AuthGuard><AcademyGlobalSearch /></AuthGuard>} />
                    <Route path="/academy/certificates" element={<AuthGuard><AcademyCertificates /></AuthGuard>} />
                    <Route path="/academy/achievements" element={<AuthGuard><AcademyAchievements /></AuthGuard>} />
                    <Route path="/academy/missions" element={<AuthGuard><AcademyMissions /></AuthGuard>} />
                    <Route path="/academy/leaderboard" element={<AuthGuard><AcademyLeaderboard /></AuthGuard>} />
                    <Route path="/academy/notifications" element={<AuthGuard><AcademyNotifications /></AuthGuard>} />
                    <Route path="/academy/saved" element={<AuthGuard><AcademySaved /></AuthGuard>} />
                    <Route path="/academy/planner" element={<AuthGuard><AcademyStudyPlanner /></AuthGuard>} />
                    <Route path="/academy/my-courses" element={<AuthGuard><AcademyMyCourses /></AuthGuard>} />
                    <Route path="/academy/my-work" element={<AuthGuard><AcademyMyWork /></AuthGuard>} />
                    <Route path="/academy/settings" element={<AuthGuard><AcademySettings /></AuthGuard>} />
                    {/* Public — certificate verification must work without an account (QR codes, shared links, employers). */}
                    <Route path="/academy/verify" element={<AcademyCertificateVerify />} />
                    <Route path="/academy/verify/:certificateNumber" element={<AcademyCertificateVerify />} />

                    {/* Library — books/audiobooks (Phase 1 architecture prep). Public browsing, gated personal pages. */}
                    <Route path="/library" element={<LibraryHome />} />
                    <Route path="/library/categories" element={<LibraryCategories />} />
                    <Route path="/library/categories/:slug" element={<LibraryCategoryDetails />} />
                    <Route path="/library/books" element={<LibraryBooksExplorer />} />
                    <Route path="/library/books/:bookId" element={<LibraryBookDetails />} />
                    <Route path="/library/read/:bookId" element={<LibraryReader />} />
                    <Route path="/library/audiobooks" element={<LibraryAudiobooks />} />
                    <Route path="/library/audiobooks/:audiobookId" element={<LibraryAudiobookPlayer />} />
                    <Route path="/library/authors" element={<LibraryAuthors />} />
                    <Route path="/library/authors/:authorId" element={<LibraryAuthorProfile />} />
                    <Route path="/library/search" element={<LibrarySearch />} />
                    <Route path="/library/quotes" element={<LibraryQuotes />} />
                    <Route path="/library/my-library" element={<AuthGuard><LibraryMyLibrary /></AuthGuard>} />
                    <Route path="/library/reading-lists" element={<AuthGuard><LibraryReadingLists /></AuthGuard>} />
                    <Route path="/library/favorites" element={<AuthGuard><LibraryFavorites /></AuthGuard>} />
                    <Route path="/library/continue-reading" element={<AuthGuard><LibraryContinueReading /></AuthGuard>} />
                    <Route path="/library/downloads" element={<AuthGuard><LibraryDownloads /></AuthGuard>} />
                    <Route path="/library/reviews" element={<AuthGuard><LibraryReviews /></AuthGuard>} />
                    <Route path="/library/community" element={<AuthGuard><LibraryCommunity /></AuthGuard>} />
                    <Route path="/library/dashboard" element={<AuthGuard><LibraryDashboard /></AuthGuard>} />
                    <Route path="/library/admin" element={<AdminRoute><LibraryAdmin /></AdminRoute>} />

                    {/* Book Marketplace (Phase 10) — public storefront pages. */}
                    <Route path="/library/wishlist" element={<AuthGuard><LibraryWishlistPage /></AuthGuard>} />
                    <Route path="/library/publishers/:slug" element={<LibraryPublisherProfile />} />
                    <Route path="/library/collections/:slug" element={<LibraryCollectionDetail />} />
                    <Route path="/library/series/:slug" element={<LibrarySeriesDetail />} />
                    <Route path="/library/bundles/:bundleId" element={<LibraryBundleDetail />} />

                    {/* Author Publishing Studio (Phase 9) — self-service; any signed-in user may become an author. */}
                    <Route path="/library/studio" element={<AuthGuard><LibraryStudioDashboard /></AuthGuard>} />
                    <Route path="/library/studio/become-author" element={<AuthGuard><LibraryBecomeAuthor /></AuthGuard>} />
                    <Route path="/library/studio/books/new" element={<AuthGuard><LibraryStudioBookWizard /></AuthGuard>} />
                    <Route path="/library/studio/books/:bookId" element={<AuthGuard><LibraryStudioBookOverview /></AuthGuard>} />
                    <Route path="/library/studio/books/:bookId/edit/:chapterId" element={<AuthGuard><LibraryStudioEditor /></AuthGuard>} />
                    <Route path="/library/studio/books/:bookId/analytics" element={<AuthGuard><LibraryStudioAnalytics /></AuthGuard>} />

                    {/* Global Digital Library (Phase 11). */}
                    <Route path="/library/import-review" element={<AdminRoute><LibraryImportReview /></AdminRoute>} />
                    <Route path="/library/collections-admin" element={<AdminRoute><LibraryCollectionsAdmin /></AdminRoute>} />
                    <Route path="/library/knowledge-graph" element={<LibraryKnowledgeGraph />} />
                    <Route path="/library/knowledge-graph/:slug" element={<LibraryKnowledgeGraphEntity />} />

                    {/* Knowledge & Research Platform (Phase 14). */}
                    <Route path="/library/knowledge-map/:entityId" element={<LibraryKnowledgeMap />} />
                    <Route path="/library/timelines" element={<LibraryTimelines />} />
                    <Route path="/library/timelines/:timelineId" element={<LibraryTimelineDetail />} />
                    <Route path="/library/ai-search" element={<LibraryAiSearch />} />
                    <Route path="/library/research-assistant" element={<AuthGuard><LibraryResearchAssistant /></AuthGuard>} />
                    <Route path="/library/research-assistant/:analysisId" element={<AuthGuard><LibraryResearchAnalysisDetail /></AuthGuard>} />
                    <Route path="/library/research-projects" element={<AuthGuard><LibraryResearchProjects /></AuthGuard>} />
                    <Route path="/library/research-projects/:projectId" element={<AuthGuard><LibraryResearchProjectDetail /></AuthGuard>} />
                    <Route path="/library/ai-insights" element={<LibraryAiInsights />} />

                    {/* AI Personal Librarian (Phase 15). */}
                    <Route path="/library/librarian" element={<AuthGuard><LibraryLibrarian /></AuthGuard>} />
                    <Route path="/library/librarian/profile" element={<AuthGuard><LibraryLibrarianProfile /></AuthGuard>} />
                    <Route path="/library/librarian/chat" element={<AuthGuard><LibraryLibrarianChat /></AuthGuard>} />
                    <Route path="/library/librarian/summaries" element={<AuthGuard><LibraryLibrarianSummaries /></AuthGuard>} />
                    <Route path="/library/librarian/privacy" element={<AuthGuard><LibraryLibrarianPrivacy /></AuthGuard>} />

                    {/* Enterprise & Organization Platform (Phase 17). */}
                    <Route path="/library/organizations" element={<AuthGuard><LibraryOrganizations /></AuthGuard>} />
                    <Route path="/library/organizations/:slug" element={<AuthGuard><LibraryOrganizationDashboard /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/members" element={<AuthGuard><LibraryOrganizationMembers /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/groups" element={<AuthGuard><LibraryOrganizationGroups /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/resources" element={<AuthGuard><LibraryOrganizationResources /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/permissions" element={<AuthGuard><LibraryOrganizationPermissions /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/licenses" element={<AuthGuard><LibraryOrganizationLicenses /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/assignments" element={<AuthGuard><LibraryOrganizationAssignments /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/analytics" element={<AuthGuard><LibraryOrganizationAnalytics /></AuthGuard>} />
                    <Route path="/library/organizations/:slug/security" element={<AuthGuard><LibraryOrganizationSecurity /></AuthGuard>} />

                    {/* Reading Community (Phase 12). */}
                    <Route path="/library/profile/:userId" element={<LibraryReaderProfile />} />
                    <Route path="/library/clubs" element={<LibraryClubs />} />
                    <Route path="/library/clubs/:slug" element={<LibraryClubDetail />} />
                    <Route path="/library/discussions/:topicId" element={<LibraryDiscussionTopic />} />
                    <Route path="/library/challenges" element={<LibraryChallenges />} />
                    <Route path="/library/events" element={<LibraryEvents />} />
                    <Route path="/library/leaderboard" element={<LibraryLeaderboard />} />

                    {/* Learning Hub (Phase 13). */}
                    <Route path="/library/learning-paths" element={<LibraryLearningPaths />} />
                    <Route path="/library/learning-paths/:pathId" element={<LibraryLearningPathDetail />} />
                    <Route path="/library/flashcards" element={<LibraryFlashcards />} />
                    <Route path="/library/flashcards/:deckId" element={<LibraryFlashcardStudyDeck />} />
                    <Route path="/library/quizzes/:quizId" element={<LibraryQuizTake />} />
                    <Route path="/library/study-assistant" element={<LibraryStudyAssistant />} />
                    <Route path="/library/learning-analytics" element={<LibraryLearningAnalytics />} />
                    <Route path="/library/certificates" element={<LibraryCertificates />} />
                    <Route path="/library/certificates/verify/:certificateNumber" element={<LibraryCertificateVerify />} />

                    <Route path="/content" element={<Content />} />
                    <Route path="/contact-us" element={<ContactUs />} />
                    <Route path="/contact" element={<Navigate to="/contact-us" replace />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="/games/kids" element={<VisionexKids />} />
                    <Route path="/games/accessible" element={<AccessibleGames />} />
                    <Route path="/games/profile" element={<AuthGuard><ArcadePlayerHub /></AuthGuard>} />
                    <Route path="/games/achievements" element={<AuthGuard><ArcadePlayerHub /></AuthGuard>} />
                    <Route path="/games/challenges" element={<AuthGuard><ArcadePlayerHub /></AuthGuard>} />
                    <Route path="/games/leaderboard" element={<AuthGuard><ArcadePlayerHub /></AuthGuard>} />
                    <Route path="/games/rewards" element={<AuthGuard><ArcadeEconomy /></AuthGuard>} />
                    <Route path="/games/tournaments" element={<AuthGuard><ArcadeEconomy /></AuthGuard>} />
                    <Route path="/games/shop" element={<AuthGuard><ArcadeEconomy /></AuthGuard>} />
                    <Route path="/games/quiz-challenge" element={<GameEconomyGate gameTitle="Quiz Challenge"><QuizChallenge /></GameEconomyGate>} />
                    <Route path="/games/memory" element={<GameEconomyGate gameTitle="Memory Game"><MemoryGame /></GameEconomyGate>} />
                    <Route path="/games/word-puzzle" element={<GameEconomyGate gameTitle="Word Puzzle"><WordPuzzle /></GameEconomyGate>} />
                    <Route path="/games/visionopoly" element={<GameEconomyGate gameTitle="Visionopoly"><Visionopoly /></GameEconomyGate>} />
                    <Route path="/assistive-products" element={<AssistiveProducts />} />
                    <Route path="/business-simulator" element={<BusinessSimulator />} />
                    <Route path="/business-simulator/:slug" element={<SimulationRunner />} />
                    <Route path="/simulations-summary" element={<SimulationsSummary />} />
                    <Route path="/services/delivery" element={<Delivery />} />
                    <Route path="/services/economy" element={<BusinessEconomy />} />
                    <Route path="/services/shared-trip" element={<SharedTrip />} />
                    <Route path="/services/nutrition" element={<NutritionExpert />} />
                    <Route path="/services/trip-history" element={<TripHistory />} />
                    <Route path="/careers" element={<Careers />} />
                    <Route path="/career/dashboard" element={<AuthGuard><CareerDashboard /></AuthGuard>} />
                    <Route path="/career/ai" element={<AuthGuard><AICareerSuite /></AuthGuard>} />
                    <Route path="/career/employer" element={<AuthGuard><EmployerDashboard /></AuthGuard>} />
                    <Route path="/career/intelligence" element={<JobIntelligence />} />
                    <Route path="/career/agent" element={<AuthGuard><CareerAgent /></AuthGuard>} />
                    <Route path="/career/network" element={<AuthGuard><CareerNetwork /></AuthGuard>} />
                    <Route path="/career/community" element={<CareerCommunity />} />
                    <Route path="/services/career-hub" element={<CareerHub />} />
                    <Route path="/services/music-conservatory" element={<MusicConservatory />} />
                    <Route path="/services/global-studio" element={<GlobalStudio />} />
                    <Route path="/services/web-design" element={<WebDesign />} />
                    <Route path="/services/digital-marketing" element={<DigitalMarketing />} />
                    <Route path="/services/import-purchasing" element={<ImportPurchasing />} />
                    <Route path="/services/tech-consulting" element={<TechConsulting />} />
                    <Route path="/services/training" element={<TrainingService />} />
                    <Route path="/services/hair-care" element={<HairCare />} />
                    <Route path="/services/legal-advisor" element={<LegalAdvisor />} />
                    <Route path="/services/medical-support" element={<MedicalSupport />} />
                    <Route path="/services/psychology" element={<Psychology />} />
                    <Route path="/services/skin-care" element={<SkinCareExpert />} />
                    <Route path="/services/social-guide" element={<SocialGuide />} />
                    <Route path="/services/sports-coach" element={<SportsCoach />} />
                    <Route path="/services/travel-agency" element={<TravelAgency />} />
                    <Route path="/services/radar-ai" element={<RadarAI />} />
                    <Route path="/services/ocr-scan" element={<OCRScan />} />
                    <Route path="/services/file-studio" element={<FileStudio />} />
                    <Route path="/services/educational-empire" element={<EducationalEmpire />} />
                    <Route path="/services/empathy-oasis" element={<EmpathyOasis />} />
                    <Route path="/services/live-tv"                      element={<LiveTV />} />
                    <Route path="/services/live-tv/subscribe"           element={<LiveTVSubscribe />} />
                    <Route path="/services/live-tv/watch/:channelId"    element={<LiveTVWatch />} />
                    <Route path="/services/live-tv/favorites"           element={<LiveTVFavorites />} />
                    <Route path="/services/live-tv/search"              element={<LiveTVSearch />} />
                    <Route path="/services/live-tv/playlists"           element={<LiveTVPlaylists />} />
                    <Route path="/services/live-tv/streaming"           element={<StreamingGuide />} />
                    <Route path="/services/live-radio" element={<LiveRadio />} />
                    <Route path="/services/live-radio/subscribe" element={<LiveRadioSubscribe />} />
                    <Route path="/services/live-radio/listen/:stationId" element={<LiveRadioListen />} />
                    {/* AI Media Studio */}
                    <Route path="/services/ai-media-studio" element={<AuthGuard><AIMediaStudio /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/projects" element={<AuthGuard><AIMediaStudioProjects /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/assets" element={<AuthGuard><AIMediaStudioAssets /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/templates" element={<AuthGuard><AIMediaStudioTemplates /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/settings" element={<AuthGuard><AIMediaStudioSettings /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/help" element={<AuthGuard><AIMediaStudioHelp /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/speech" element={<AuthGuard><AIMediaStudioSpeech /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/voice"  element={<AuthGuard><AIMediaStudioVoice /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/video"        element={<AuthGuard><AIMediaStudioVideo /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/provider-hub" element={<AuthGuard><AIMediaStudioProviderHub /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/billing"      element={<AuthGuard><AIMediaStudioBilling /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/image"       element={<AuthGuard><AIMediaStudioImage /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/diagnostics" element={<AuthGuard><AIMediaStudioDiagnostics /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/document"    element={<AuthGuard><AIMediaStudioDocument /></AuthGuard>} />
                    <Route path="/services/ai-media-studio/text-tools"  element={<AuthGuard><AIMediaStudioTextTools /></AuthGuard>} />
                    <Route path="/games/hangman" element={<GameEconomyGate gameTitle="Hangman"><Hangman /></GameEconomyGate>} />
                    <Route path="/games/dominoes" element={<GameEconomyGate gameTitle="Dominoes"><Dominoes /></GameEconomyGate>} />
                    <Route path="/games/farkle" element={<GameEconomyGate gameTitle="Farkle"><FarkleGame /></GameEconomyGate>} />
                    <Route path="/games/jungle-survival" element={<GameEconomyGate gameTitle="Jungle Survival"><JungleSurvival /></GameEconomyGate>} />
                    <Route path="/games/star-chef" element={<GameEconomyGate gameTitle="Star Chef"><StarChef /></GameEconomyGate>} />
                    <Route path="/games/uno-ultra" element={<GameEconomyGate gameTitle="Uno Ultra"><UnoUltra /></GameEconomyGate>} />
                    <Route path="/games/neon-breach" element={<GameEconomyGate gameTitle="Neon Breach"><NeonBreach /></GameEconomyGate>} />
                    <Route path="/games/logiquest" element={<GameEconomyGate gameTitle="LogiQuest"><LogiQuest /></GameEconomyGate>} />
                    <Route path="/games/trade-tycoon" element={<GameEconomyGate gameTitle="Trade Tycoon"><TradeTycoon /></GameEconomyGate>} />
                    <Route path="/games/tactical-strike" element={<GameEconomyGate gameTitle="Tactical Strike"><TacticalStrike /></GameEconomyGate>} />
                    <Route path="/games/briscola" element={<GameEconomyGate gameTitle="Briscola"><Briscola /></GameEconomyGate>} />
                    <Route path="/games/card-99" element={<GameEconomyGate gameTitle="Card 99"><Card99 /></GameEconomyGate>} />
                    <Route path="/games/dream-home" element={<GameEconomyGate gameTitle="Dream Home"><DreamHome /></GameEconomyGate>} />
                    <Route path="/games/laptop-tech" element={<GameEconomyGate gameTitle="Laptop Tech Master"><LaptopTechMaster /></GameEconomyGate>} />
                    <Route path="/games/music-ear" element={<GameEconomyGate gameTitle="Music Ear Master"><MusicEarMaster /></GameEconomyGate>} />
                    <Route path="/games/fashion-designer" element={<GameEconomyGate gameTitle="Fashion Designer"><FashionDesigner /></GameEconomyGate>} />
                    <Route path="/games/velocity-racing" element={<GameEconomyGate gameTitle="Velocity X Racing"><VelocityXRacing /></GameEconomyGate>} />
                    <Route path="/games/akinator" element={<GameEconomyGate gameTitle="Akinator"><Akinator /></GameEconomyGate>} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/community/voice-rooms" element={<VoiceRooms />} />
                    <Route path="/community/room/:roomId" element={<VoiceRoom />} />
                    <Route path="/community/voice-room/:roomId" element={<VoiceRoom />} />
                    <Route path="/coins-store" element={<CoinsStore />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/newsletter/preferences" element={<NewsletterPreferences />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/settings" element={<Settings />} />
<Route path="/professional-tools" element={<ProfessionalTools />} />
                    <Route path="/professional-tools/:toolId" element={<ToolDetail />} />
                    {/* ── Visionex Finance ───────────────────────────────── */}
                    <Route path="/finance" element={<FinanceDashboard />} />
                    <Route path="/finance/markets" element={<FinanceMarkets />} />
                    <Route path="/finance/markets/stocks" element={<FinanceStocks />} />
                    <Route path="/finance/markets/currencies" element={<FinanceCurrencies />} />
                    <Route path="/finance/markets/commodities" element={<FinanceCommodities />} />
                    <Route path="/finance/portfolio" element={<AuthGuard><FinancePortfolio /></AuthGuard>} />
                    <Route path="/finance/watchlist" element={<AuthGuard><FinanceWatchlist /></AuthGuard>} />
                    <Route path="/finance/ai-analyst" element={<AuthGuard><FinanceAIAnalyst /></AuthGuard>} />
                    <Route path="/finance/calendar" element={<FinanceCalendar />} />
                    <Route path="/finance/news" element={<FinanceNews />} />
                    <Route path="/finance/affiliate" element={<AuthGuard><FinanceAffiliate /></AuthGuard>} />
                    <Route path="/finance/brokers" element={<FinanceBrokers />} />
                    <Route path="/finance/academy" element={<FinanceAcademy />} />
                    <Route path="/finance/settings" element={<Navigate to="/settings" replace />} />
                    {/* Legal — all policies accessible through /legal (LegalCenter) */}
                    <Route path="/legal" element={<LegalCenter />} />
                    <Route path="/privacy-policy"        element={<Navigate to="/legal" replace />} />
                    <Route path="/terms-of-use"          element={<Navigate to="/legal" replace />} />
                    <Route path="/marketplace-policy"    element={<Navigate to="/legal" replace />} />
                    <Route path="/community-guidelines"  element={<Navigate to="/legal" replace />} />
                    <Route path="/accessibility"         element={<Navigate to="/legal" replace />} />
                    <Route path="/legal-disclaimer"      element={<Navigate to="/legal" replace />} />
                    <Route path="/ai-policy"             element={<Navigate to="/legal" replace />} />
                    <Route path="/vx-coins-policy"       element={<Navigate to="/legal" replace />} />
                    <Route path="/buyer-protection"      element={<Navigate to="/legal" replace />} />
                    <Route path="/intellectual-property" element={<Navigate to="/legal" replace />} />
                    <Route path="/enforcement-appeals"   element={<Navigate to="/legal" replace />} />
                    {/* Admin routes */}
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/infra" element={<AdminRoute><AdminInfra /></AdminRoute>} />
                    <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
                    <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                    <Route path="/admin/requests" element={<AdminRoute><AdminRequests /></AdminRoute>} />
                    <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                    <Route path="/admin/subscribers" element={<AdminRoute><AdminSubscribers /></AdminRoute>} />
                    <Route path="/admin/moderation" element={<AdminRoute><AdminModeration /></AdminRoute>} />
                    <Route path="/admin/emails" element={<AdminRoute><AdminEmails /></AdminRoute>} />
                    <Route path="/admin/database" element={<AdminRoute><AdminDatabase /></AdminRoute>} />
                    <Route path="/admin/vx" element={<AdminRoute><AdminVX /></AdminRoute>} />
                    <Route path="/admin/vx-coin-orders" element={<AdminRoute><AdminVXCoinOrders /></AdminRoute>} />
                    <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
                    <Route path="/admin/simulations" element={<AdminRoute><AdminSimulations /></AdminRoute>} />
                    <Route path="/admin/news" element={<AdminRoute><AdminNews /></AdminRoute>} />
                    <Route path="/admin/instructor-applications" element={<AdminRoute><AdminInstructorApplications /></AdminRoute>} />
                    <Route path="/admin/library-resources" element={<AdminRoute><AdminLibraryResources /></AdminRoute>} />
                    <Route path="/admin/scholarships" element={<AdminRoute><AdminScholarships /></AdminRoute>} />
                    <Route path="/admin/universities" element={<AdminRoute><AdminUniversities /></AdminRoute>} />
                    <Route path="/admin/academy" element={<AdminRoute><AdminAcademyHub /></AdminRoute>} />
                    <Route path="/admin/academy/students" element={<AdminRoute><AdminAcademyStudents /></AdminRoute>} />
                    <Route path="/admin/academy/gamification" element={<AdminRoute><AdminAcademyGamification /></AdminRoute>} />
                    <Route path="/admin/academy/analytics" element={<AdminRoute><AdminAcademyAnalytics /></AdminRoute>} />
                    <Route path="/admin/bazaar" element={<AdminRoute><AdminBazaar /></AdminRoute>} />
                    <Route path="/admin/tv" element={<AdminRoute><AdminTV /></AdminRoute>} />
                    <Route path="/admin/radio" element={<AdminRoute><AdminRadio /></AdminRoute>} />
                    <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
                    <Route path="/admin/arcade-economy" element={<AdminRoute><AdminArcadeEconomy /></AdminRoute>} />

                    {/* VisionKids — accessibility-first kids' hub. Own layout (top nav + sidebar),
                        independent from the site-wide Layout/Header. Public browsing throughout;
                        /kids/:sectionSlug is data-driven off kidsSections, so adding a 17th
                        section later is a data-file change, not a new route. */}
                    <Route path="/kids" element={<VisionKidsLayout />}>
                      <Route index element={<VisionKidsHome />} />
                      <Route path="settings" element={<VisionKidsSettings />} />

                      {/* Phase 2 — Smart Stories Library. Static segments (stories/*)
                          out-rank the ":sectionSlug" catch-all below regardless of
                          declaration order (React Router ranks literal segments over
                          params), but declared first here for readability. */}
                      <Route path="stories" element={<StoriesHome />} />
                      <Route path="stories/categories" element={<StoryCategories />} />
                      <Route path="stories/category/:categorySlug" element={<StoryBrowse />} />
                      <Route path="stories/search" element={<StoryBrowse />} />
                      <Route path="stories/recommended" element={<StoryRecommended />} />
                      <Route path="stories/story/:slug" element={<StoryDetails />} />
                      <Route path="stories/read/:slug" element={<StoryReader />} />
                      <Route path="stories/listen/:slug" element={<StoryAudioPlayer />} />
                      <Route path="stories/quiz/:slug" element={<StoryQuizPage />} />
                      <Route path="stories/favorites" element={<StoryFavorites />} />
                      <Route path="stories/downloads" element={<StoryDownloads />} />
                      <Route path="stories/continue-reading" element={<StoryContinueReading />} />
                      <Route path="stories/history" element={<StoryHistory />} />
                      <Route path="stories/ai" element={<AiStories />} />
                      <Route path="stories/ai/create" element={<AiStoryCreate />} />
                      <Route path="stories/ai/:id" element={<AiStoryDetail />} />

                      {/* Phase 3 — Educational Games Platform. Same reasoning as stories/* above:
                          static segments out-rank the ":sectionSlug" catch-all. */}
                      <Route path="games" element={<GamesHome />} />
                      <Route path="games/categories" element={<GameCategories />} />
                      <Route path="games/category/:categorySlug" element={<GameBrowse />} />
                      <Route path="games/search" element={<GameBrowse />} />
                      <Route path="games/game/:slug" element={<GameDetails />} />
                      <Route path="games/play/:slug" element={<GamePlay />} />
                      <Route path="games/recently-played" element={<RecentlyPlayed />} />
                      <Route path="games/favorites" element={<GameFavorites />} />
                      <Route path="games/achievements" element={<Achievements />} />
                      <Route path="games/leaderboard" element={<GamesLeaderboard />} />
                      <Route path="games/daily-challenges" element={<DailyChallenges />} />
                      <Route path="games/weekly-challenges" element={<WeeklyChallenges />} />
                      <Route path="games/multiplayer" element={<MultiplayerLobby />} />
                      <Route path="games/multiplayer/:roomId" element={<MultiplayerRoomView />} />
                      <Route path="games/profile" element={<GameProfile />} />

                      {/* Phase 4 — Academy. Same reasoning as stories/* and games/* above:
                          static segments out-rank the ":sectionSlug" catch-all, and this
                          replaces "academy" ever falling through to the generic
                          VisionKidsSection placeholder. */}
                      <Route path="academy" element={<AcademyHome />} />
                      <Route path="academy/subjects" element={<AcademySubjects />} />
                      <Route path="academy/subject/:subjectSlug" element={<SubjectCourses />} />
                      <Route path="academy/course/:slug" element={<CourseDetail />} />
                      <Route path="academy/course/:courseSlug/lesson/:lessonSlug" element={<LessonPlayer />} />
                      <Route path="academy/course/:slug/exam" element={<AcademyExams />} />
                      <Route path="academy/homework" element={<AcademyHomework />} />
                      <Route path="academy/projects" element={<AcademyProjects />} />
                      <Route path="academy/projects/:projectId" element={<ProjectSubmit />} />
                      <Route path="academy/certificates" element={<KidsAcademyCertificates />} />
                      <Route path="academy/certificates/verify/:certificateNumber" element={<CertificateVerify />} />
                      <Route path="academy/parents" element={<ParentsDashboard />} />
                      <Route path="academy/teacher" element={<TeacherDashboard />} />
                      <Route path="academy/teacher/course/:courseId" element={<TeacherCourseManage />} />
                      <Route path="academy/analytics" element={<LearningAnalytics />} />
                      <Route path="academy/learning-path" element={<LearningPath />} />
                      <Route path="academy/downloads" element={<AcademyDownloads />} />

                      {/* Phase 5 — AI Creative Studio. Same reasoning as stories/*, games/*,
                          academy/* above: static segments out-rank the ":sectionSlug"
                          catch-all. "studio" replaces the generic VisionKidsSection
                          placeholder that used to serve /kids/coding etc — no, this is a
                          new "studio" slug, distinct from the existing 16 home sections. */}
                      <Route path="studio" element={<StudioHome />} />
                      <Route path="studio/drawing-studio/:projectId" element={<DrawingStudio />} />
                      <Route path="studio/character-builder/:projectId" element={<CharacterBuilder />} />
                      <Route path="studio/sticker-maker/:projectId" element={<StickerMaker />} />
                      <Route path="studio/music-studio" element={<MusicStudio />} />
                      <Route path="studio/voice-studio" element={<VoiceStudio />} />
                      <Route path="studio/cartoon-creator" element={<CartoonCreator />} />
                      <Route path="studio/comic-creator" element={<ComicCreator />} />
                      <Route path="studio/book-creator/:projectId" element={<BookCreator />} />
                      <Route path="studio/video-creator" element={<VideoCreator />} />
                      <Route path="studio/gallery" element={<StudioGallery />} />
                      <Route path="studio/templates" element={<StudioTemplates />} />
                      <Route path="studio/challenges" element={<CreativeChallenges />} />
                      <Route path="studio/my-projects" element={<MyProjects />} />

                      {/* Phase 6 — Explorer. "world/:worldSlug" and
                          "world/:worldSlug/:locationSlug(/quiz)" are ONE generic
                          template shared by all 9 browse-and-learn worlds (see
                          CONTENT_WORLD_CONFIG) — adding a 10th world needs no new
                          route. The 4 simulators + hub/passport get their own
                          static segments, same static-before-catch-all reasoning
                          as every section above. */}
                      <Route path="explorer" element={<ExplorerHome />} />
                      <Route path="explorer/virtual-world" element={<VirtualWorld />} />
                      <Route path="explorer/passport" element={<ExplorerPassport />} />
                      <Route path="explorer/space-mission" element={<SpaceMission />} />
                      <Route path="explorer/city-builder" element={<CityBuilder />} />
                      <Route path="explorer/farm-simulator" element={<FarmSimulator />} />
                      <Route path="explorer/eco-world" element={<EcoWorld />} />
                      <Route path="explorer/world/:worldSlug" element={<ExplorerWorldListPage />} />
                      <Route path="explorer/world/:worldSlug/:locationSlug" element={<ExplorerLocationDetailPage />} />
                      <Route path="explorer/world/:worldSlug/:locationSlug/quiz" element={<ExplorerLocationQuizPage />} />

                      {/* Phase 7 — Social & Parents Hub. "clubs/:category" (study/
                          reading/creative) is one generic template shared by every
                          club type, same discipline as Explorer's world template —
                          "clubs/detail/:slug" is a distinct 2-segment static-prefixed
                          route so it never collides with the 1-segment category
                          route. Same static-before-catch-all reasoning as every
                          section above for everything else here. */}
                      <Route path="social" element={<CommunityHome />} />
                      <Route path="social/friends" element={<SocialFriends />} />
                      <Route path="social/challenges" element={<SocialChallengesHub />} />
                      <Route path="social/notifications" element={<SocialNotifications />} />
                      <Route path="social/reports" element={<SocialReports />} />
                      <Route path="social/settings" element={<SocialSettings />} />
                      <Route path="social/moderation" element={<ModerationPanel />} />
                      <Route path="social/clubs/detail/:slug" element={<ClubDetailPage />} />
                      <Route path="social/clubs/detail/:slug/quiz" element={<ClubQuizPage />} />
                      <Route path="social/clubs/:category" element={<ClubListPage />} />
                      <Route path="social/chat" element={<SafeChatHome />} />
                      <Route path="social/chat/:conversationId" element={<ChatThread />} />
                      <Route path="social/voice-rooms" element={<VoiceRoomLobby />} />
                      <Route path="social/voice-rooms/:roomId" element={<VoiceRoomLive />} />
                      <Route path="social/parents/family" element={<FamilyAccounts />} />
                      <Route path="social/parents/dashboard" element={<SocialParentsDashboard />} />
                      <Route path="social/parents/timeline" element={<SocialActivityTimeline />} />
                      <Route path="social/parents/settings" element={<SocialParentSettings />} />

                      {/* Phase 8 — Live Events & Universe. "events/:listType" (live/
                          workshops/competitions/seasonal) is one generic list template,
                          same discipline as Explorer's world template — the static
                          events/* segments (calendar, my-events, rewards, replays, …)
                          out-rank it, and "events/detail/:slug(/register)" plus
                          "events/room/:slug" are static-prefixed so they never collide
                          with the 1-segment :listType route. The Universe map lives at
                          the top-level /kids/universe, not under events. */}
                      <Route path="events" element={<EventsHome />} />
                      <Route path="events/calendar" element={<EventsCalendar />} />
                      <Route path="events/my-events" element={<MyEvents />} />
                      <Route path="events/notifications" element={<EventNotifications />} />
                      <Route path="events/rewards" element={<EventsRewardsCenter />} />
                      <Route path="events/certificates" element={<EventCertificates />} />
                      <Route path="events/replays" element={<ReplayLibrary />} />
                      <Route path="events/replays/:replayId" element={<ReplayPlayer />} />
                      <Route path="events/detail/:slug" element={<EventDetails />} />
                      <Route path="events/detail/:slug/register" element={<EventRegistration />} />
                      <Route path="events/room/:slug" element={<LiveEventRoom />} />
                      <Route path="events/:listType" element={<EventListPage />} />
                      <Route path="universe" element={<UniverseMap />} />
                      <Route path="universe/:citySlug" element={<UniverseCityDetail />} />

                      {/* Phase 9 — Talent Hub & Future Skills. "track/:trackSlug"
                          (and "track/:trackSlug/:moduleSlug") is ONE generic template
                          shared by all 10 academies/labs (Coding, Robotics, AI, Music,
                          Art, Writing, Public Speaking, Entrepreneurship, Financial
                          Literacy, Innovation Lab) — same discipline as Explorer's world
                          template; adding an 11th track needs no new route. Static
                          talent/* segments out-rank the param routes as always. */}
                      <Route path="talent" element={<TalentHubHome />} />
                      <Route path="talent/assessment" element={<TalentAssessment />} />
                      <Route path="talent/my-talents" element={<MyTalents />} />
                      <Route path="talent/skill-tree" element={<SkillTree />} />
                      <Route path="talent/future-skills" element={<TalentFutureSkills />} />
                      <Route path="talent/future-skills/:slug" element={<FutureSkillDetail />} />
                      <Route path="talent/portfolio" element={<TalentPortfolio />} />
                      <Route path="talent/achievements" element={<TalentAchievements />} />
                      <Route path="talent/careers" element={<CareerExplorer />} />
                      <Route path="talent/careers/:slug" element={<CareerDetail />} />
                      <Route path="talent/mentors" element={<TalentMentors />} />
                      <Route path="talent/track/:trackSlug" element={<TalentTrackDetail />} />
                      <Route path="talent/track/:trackSlug/:moduleSlug" element={<TalentModuleDetail />} />

                      {/* Phase 10 — Health & Wellness Hub. Nutrition/Exercise/
                          Mindfulness/Safety/First-Aid all render through ONE generic
                          CategoryLessonsPage (see wellness/components), and
                          "lesson/:category/:slug" is the single shared lesson-player
                          route for every category. Static health/* segments out-rank
                          the :sectionSlug catch-all below as always. */}
                      <Route path="health" element={<HealthHome />} />
                      <Route path="health/routine" element={<DailyRoutine />} />
                      <Route path="health/habits" element={<HealthyHabits />} />
                      <Route path="health/nutrition" element={<Nutrition />} />
                      <Route path="health/exercise" element={<ExerciseCenter />} />
                      <Route path="health/sleep" element={<SleepTracker />} />
                      <Route path="health/mood" element={<MoodJournal />} />
                      <Route path="health/mindfulness" element={<Mindfulness />} />
                      <Route path="health/safety" element={<SafetyAcademy />} />
                      <Route path="health/first-aid" element={<FirstAidKids />} />
                      <Route path="health/companion" element={<SmartCompanion />} />
                      <Route path="health/challenges" element={<HealthyChallenges />} />
                      <Route path="health/emergency" element={<EmergencyGuide />} />
                      <Route path="health/rewards" element={<WellnessRewards />} />
                      <Route path="health/accessibility" element={<WellnessAccessibility />} />
                      <Route path="health/lesson/:category/:slug" element={<WellnessLessonDetail />} />

                      {/* Phase 11 — STEM & Innovation Center. The 8 "list" labs
                          (Science…Space) each render through ONE generic
                          LabExperimentsPage over the polymorphic kids_experiments
                          catalog, and "experiment/:lab/:slug" is the single shared
                          runner (steps + simulation + quiz) for every experiment —
                          scaling to thousands of experiments with no new routes.
                          Robotics / 3D are interactive builders; innovation /
                          gallery / research are the centers. Static stem/* segments
                          out-rank the :sectionSlug catch-all as always. */}
                      <Route path="stem" element={<StemHome />} />
                      <Route path="stem/science" element={<ScienceLab />} />
                      <Route path="stem/physics" element={<PhysicsLab />} />
                      <Route path="stem/chemistry" element={<ChemistryLab />} />
                      <Route path="stem/biology" element={<BiologyLab />} />
                      <Route path="stem/math" element={<MathLab />} />
                      <Route path="stem/engineering" element={<EngineeringLab />} />
                      <Route path="stem/electronics" element={<ElectronicsLab />} />
                      <Route path="stem/space" element={<SpaceEngineering />} />
                      <Route path="stem/robotics" element={<RoboticsWorkshop />} />
                      <Route path="stem/design3d" element={<Design3DStudio />} />
                      <Route path="stem/innovation" element={<InnovationChallenges />} />
                      <Route path="stem/innovation/:slug" element={<InnovationChallengeDetail />} />
                      <Route path="stem/gallery" element={<InventorGallery />} />
                      <Route path="stem/research" element={<ResearchCenter />} />
                      <Route path="stem/research/:slug" element={<ResearchArticlePage />} />
                      <Route path="stem/rewards" element={<StemRewards />} />
                      <Route path="stem/accessibility" element={<StemAccessibility />} />
                      <Route path="stem/experiment/:lab/:slug" element={<StemExperimentDetail />} />

                      {/* Phase 12 — VisionKids World. Every district/island is
                          the SAME generic RegionPage over the polymorphic
                          kids_world_activities + kids_npcs catalogs; named
                          districts get a static route, islands + any future
                          region use "region/:slug" — so adding a region or a
                          whole new world is a catalog row, never a refactor.
                          Marketplace/Home/Transport/Weather/Passport are the
                          bespoke systems. Static world/* out-rank :sectionSlug. */}
                      <Route path="world" element={<WorldHome />} />
                      <Route path="world/map" element={<WorldInteractiveMap />} />
                      <Route path="world/my-home" element={<WorldMyHome />} />
                      <Route path="world/dream-city" element={<WorldDreamCity />} />
                      <Route path="world/adventure-islands" element={<WorldAdventureIslands />} />
                      <Route path="world/science-city" element={<WorldScienceCity />} />
                      <Route path="world/reading-village" element={<WorldReadingVillage />} />
                      <Route path="world/art-district" element={<WorldArtDistrict />} />
                      <Route path="world/music-town" element={<WorldMusicTown />} />
                      <Route path="world/sports-arena" element={<WorldSportsArena />} />
                      <Route path="world/space-port" element={<WorldSpacePort />} />
                      <Route path="world/ocean-world" element={<WorldOceanWorld />} />
                      <Route path="world/nature-park" element={<WorldNaturePark />} />
                      <Route path="world/events-plaza" element={<WorldEventsPlaza />} />
                      <Route path="world/marketplace" element={<WorldMarketplace />} />
                      <Route path="world/transportation" element={<WorldTransportation />} />
                      <Route path="world/weather" element={<WorldWeatherCenter />} />
                      <Route path="world/passport" element={<WorldPassport />} />
                      <Route path="world/accessibility" element={<WorldAccessibility />} />
                      <Route path="world/region/:slug" element={<WorldRegionRoute />} />

                      {/* Phase 13 — Creator & Education Marketplace. Every
                          content type (course/book/game/worksheet/3D/AI-prompt/…)
                          is ONE polymorphic products catalog rendered by the
                          generic ProductListPage — the per-type pages are thin
                          wrappers, so a new content type needs no new page. The
                          role dashboards share one CreatorWorkspace. Nothing
                          reaches children un-reviewed: submit → auto-moderation →
                          human ModerationQueue → published. Static market/* out-
                          rank the :sectionSlug catch-all. */}
                      <Route path="market" element={<MarketHome />} />
                      <Route path="market/discover" element={<MarketDiscover />} />
                      <Route path="market/product/:slug" element={<MarketProductDetail />} />
                      <Route path="market/courses" element={<MarketCourses />} />
                      <Route path="market/books" element={<MarketBooks />} />
                      <Route path="market/games" element={<MarketGames />} />
                      <Route path="market/worksheets" element={<MarketWorksheets />} />
                      <Route path="market/templates" element={<MarketTemplates />} />
                      <Route path="market/music" element={<MarketMusic />} />
                      <Route path="market/videos" element={<MarketVideos />} />
                      <Route path="market/3d-models" element={<MarketModels3D />} />
                      <Route path="market/ai-prompts" element={<MarketAIPrompts />} />
                      <Route path="market/bundles" element={<MarketBundles />} />
                      <Route path="market/orders" element={<MarketOrders />} />
                      <Route path="market/wishlist" element={<MarketWishlist />} />
                      <Route path="market/creator" element={<MarketCreatorDashboard />} />
                      <Route path="market/teacher" element={<MarketTeacherDashboard />} />
                      <Route path="market/publisher" element={<MarketPublisherDashboard />} />
                      <Route path="market/developer" element={<MarketDeveloperDashboard />} />
                      <Route path="market/analytics" element={<MarketCreatorAnalytics />} />
                      <Route path="market/verification" element={<MarketCreatorVerification />} />
                      <Route path="market/moderation" element={<MarketModerationQueue />} />
                      <Route path="market/accessibility" element={<MarketAccessibility />} />

                      {/* Phase 14 — Platform Core & Plugin System. The platform
                          is data-driven: engines (registry), plugins (catalog +
                          per-user installs granting only declared permissions),
                          widgets (registry → customizable dashboard), and themes
                          (Theme Engine) all extend without touching core code.
                          Nothing executes uploaded code — installing toggles a
                          built-in module. Static platform/* out-rank :sectionSlug. */}
                      <Route path="platform" element={<PlatformHub />} />
                      <Route path="platform/marketplace" element={<PlatformMarketplace />} />
                      <Route path="platform/my-plugins" element={<PlatformMyPlugins />} />
                      <Route path="platform/dashboard" element={<PlatformDashboard />} />
                      <Route path="platform/themes" element={<PlatformThemes />} />
                      <Route path="platform/settings" element={<PlatformSettings />} />
                      <Route path="platform/notifications" element={<PlatformNotifications />} />
                      <Route path="platform/analytics" element={<PlatformAnalytics />} />
                      <Route path="platform/accessibility" element={<PlatformAccessibility />} />

                      {/* Phase 15 — Enterprise & School Ecosystem. Multi-tenant:
                          every org's data is isolated by RLS membership helpers,
                          and the active tenant is chosen via the header org
                          switcher (useCurrentOrg). Rosters (students/teachers/
                          parents) share one MembersRoster over kids_org_members.
                          "verify" is a PUBLIC QR-verification page (no org).
                          Static enterprise/* out-rank the :sectionSlug catch-all. */}
                      <Route path="enterprise" element={<EnterpriseHome />} />
                      <Route path="enterprise/schools" element={<EntSchoolsPortal />} />
                      <Route path="enterprise/dashboard" element={<EntSchoolDashboard />} />
                      <Route path="enterprise/classrooms" element={<EntClassrooms />} />
                      <Route path="enterprise/students" element={<EntStudents />} />
                      <Route path="enterprise/teachers" element={<EntTeachers />} />
                      <Route path="enterprise/parents" element={<EntParents />} />
                      <Route path="enterprise/attendance" element={<EntAttendance />} />
                      <Route path="enterprise/assignments" element={<EntAssignments />} />
                      <Route path="enterprise/timetable" element={<EntTimetable />} />
                      <Route path="enterprise/exams" element={<EntExams />} />
                      <Route path="enterprise/certificates" element={<EntCertificates />} />
                      <Route path="enterprise/verify" element={<EntCertificateVerify />} />
                      <Route path="enterprise/resources" element={<EntResourceCenter />} />
                      <Route path="enterprise/communication" element={<EntCommunication />} />
                      <Route path="enterprise/reports" element={<EntReports />} />
                      <Route path="enterprise/analytics" element={<EntAnalytics />} />
                      <Route path="enterprise/settings" element={<EntOrgSettings />} />
                      <Route path="enterprise/accessibility" element={<EntAccessibility />} />

                      {/* Phase 16 — AI Operations & Quality (INTERNAL, admin-gated).
                          Every page renders behind <AdminGate>; non-admins get a
                          lock screen. Not surfaced on the kids home grid. Ops
                          tables are admin-only RLS; feature flags + maintenance
                          are public-read so the app can react to them. */}
                      <Route path="ops" element={<OpsDashboard />} />
                      <Route path="ops/health" element={<OpsSystemHealth />} />
                      <Route path="ops/ai" element={<OpsAIMonitoring />} />
                      <Route path="ops/content" element={<OpsContentReview />} />
                      <Route path="ops/accessibility" element={<OpsAccessibility />} />
                      <Route path="ops/performance" element={<OpsPerformance />} />
                      <Route path="ops/errors" element={<OpsErrors />} />
                      <Route path="ops/security" element={<OpsSecurity />} />
                      <Route path="ops/releases" element={<OpsReleases />} />
                      <Route path="ops/audit" element={<OpsAudit />} />
                      <Route path="ops/testing" element={<OpsTesting />} />
                      <Route path="ops/logs" element={<OpsLogs />} />
                      <Route path="ops/insights" element={<OpsInsights />} />
                      <Route path="ops/incidents" element={<OpsIncidents />} />
                      <Route path="ops/maintenance" element={<OpsMaintenance />} />

                      {/* Phase 17 — Economy & Sustainability. The VX wallet reuses
                          user_points/spend_vx; no real-money gateway (a `provider`
                          column is reserved for one later). A child can never
                          self-activate a PAID plan — child subscriptions land as
                          'pending_parent' and only a nominated guardian approves
                          them. Redeems/gifts/donations move only VX coins. Static
                          economy/* out-rank the :sectionSlug catch-all. */}
                      <Route path="economy" element={<EconomyHome />} />
                      <Route path="economy/plans" element={<EconMembershipPlans />} />
                      <Route path="economy/family-plans" element={<EconFamilyPlans />} />
                      <Route path="economy/school-plans" element={<EconSchoolPlans />} />
                      <Route path="economy/ngo-plans" element={<EconNGOPlans />} />
                      <Route path="economy/wallet" element={<EconWallet />} />
                      <Route path="economy/rewards" element={<EconRewards />} />
                      <Route path="economy/redeem" element={<EconRedeem />} />
                      <Route path="economy/gifts" element={<EconGifts />} />
                      <Route path="economy/subscriptions" element={<EconSubscriptions />} />
                      <Route path="economy/invoices" element={<EconInvoices />} />
                      <Route path="economy/donate" element={<EconDonate />} />
                      <Route path="economy/partners" element={<EconPartners />} />
                      <Route path="economy/creator-revenue" element={<EconCreatorRevenue />} />
                      <Route path="economy/reports" element={<EconReports />} />
                      <Route path="economy/accessibility" element={<EconAccessibility />} />

                      {/* Phase 18 — Everywhere (Multi-Platform & Offline). One
                          shared core; the PWA + IndexedDB offline layer + sync
                          engine (last-write-wins, never silent-delete) + device
                          management live here. Native wrappers reuse this core
                          via window.__VISIONKIDS_PLATFORM__. See
                          docs/visionkids-everywhere.md. */}
                      <Route path="everywhere" element={<EverywhereHome />} />
                      <Route path="everywhere/devices" element={<EwMyDevices />} />
                      <Route path="everywhere/downloads" element={<EwDownloads />} />
                      <Route path="everywhere/offline" element={<EwOffline />} />
                      <Route path="everywhere/connection" element={<EwConnection />} />
                      <Route path="everywhere/tv" element={<EwTvMode />} />
                      <Route path="everywhere/accessibility" element={<EwAccessibility />} />

                      <Route path=":sectionSlug" element={<VisionKidsSection />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
      </Suspense>
    </PageErrorBoundary>
  );
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <CurrencyProvider>
                  <SoundProvider>
                    <AppRoutes />
                  </SoundProvider>
                </CurrencyProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
