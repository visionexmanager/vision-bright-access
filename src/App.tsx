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
const QuizChallenge = lazy(() => import("./pages/QuizChallenge"));
const MemoryGame = lazy(() => import("./pages/MemoryGame"));
const WordPuzzle = lazy(() => import("./pages/WordPuzzle"));
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
                    <Route path="/games/quiz-challenge" element={<GameEconomyGate gameTitle="Quiz Challenge"><QuizChallenge /></GameEconomyGate>} />
                    <Route path="/games/memory" element={<GameEconomyGate gameTitle="Memory Game"><MemoryGame /></GameEconomyGate>} />
                    <Route path="/games/word-puzzle" element={<GameEconomyGate gameTitle="Word Puzzle"><WordPuzzle /></GameEconomyGate>} />
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
