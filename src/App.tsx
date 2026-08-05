import { Suspense } from "react";
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
import { lazyWithRetry } from "@/lib/chunkRecovery";

// Lazy-loaded pages for code splitting
const Index = lazyWithRetry(() => import("./pages/Index"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const Signup = lazyWithRetry(() => import("./pages/Signup"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const VXBazaar = lazyWithRetry(() => import("./pages/VXBazaar"));
const Services = lazyWithRetry(() => import("./pages/ServiceCenter"));
const ServiceProfile = lazyWithRetry(() => import("./pages/services/ServiceProfile"));
const MyServiceRequests = lazyWithRetry(() => import("./pages/services/MyServiceRequests"));
const Academy = lazyWithRetry(() => import("./pages/Academy"));
const AcademyCourseCatalog = lazyWithRetry(() => import("./pages/academy/AcademyCourseCatalog"));
const AcademyCourseDetail = lazyWithRetry(() => import("./pages/academy/AcademyCourseDetail"));
const AcademyLearningPlayer = lazyWithRetry(() => import("./pages/academy/AcademyLearningPlayer"));
const AcademyLearningTracks = lazyWithRetry(() => import("./pages/academy/AcademyLearningTracks"));
const AcademyInstructorProfile = lazyWithRetry(() => import("./pages/academy/AcademyInstructorProfile"));
const AcademyBecomeInstructor = lazyWithRetry(() => import("./pages/academy/AcademyBecomeInstructor"));
const AcademyInstructorDashboard = lazyWithRetry(() => import("./pages/academy/AcademyInstructorDashboard"));
const AcademyCourseEditor = lazyWithRetry(() => import("./pages/academy/AcademyCourseEditor"));
const AcademyLibrary = lazyWithRetry(() => import("./pages/academy/AcademyLibrary"));
const AcademyResourceViewer = lazyWithRetry(() => import("./pages/academy/AcademyResourceViewer"));
const AcademyScholarships = lazyWithRetry(() => import("./pages/academy/AcademyScholarships"));
const AcademyScholarshipDetail = lazyWithRetry(() => import("./pages/academy/AcademyScholarshipDetail"));
const AcademyUniversities = lazyWithRetry(() => import("./pages/academy/AcademyUniversities"));
const AcademyUniversityDetail = lazyWithRetry(() => import("./pages/academy/AcademyUniversityDetail"));
const AcademyGlobalSearch = lazyWithRetry(() => import("./pages/academy/AcademyGlobalSearch"));
const AcademyCertificates = lazyWithRetry(() => import("./pages/academy/AcademyCertificates"));
const AcademyCertificateVerify = lazyWithRetry(() => import("./pages/academy/AcademyCertificateVerify"));
const AcademyAchievements = lazyWithRetry(() => import("./pages/academy/AcademyAchievements"));
const AcademyMissions = lazyWithRetry(() => import("./pages/academy/AcademyMissions"));
const AcademyLeaderboard = lazyWithRetry(() => import("./pages/academy/AcademyLeaderboard"));
const AcademyNotifications = lazyWithRetry(() => import("./pages/academy/AcademyNotifications"));
const AcademySaved = lazyWithRetry(() => import("./pages/academy/AcademySaved"));
const AcademyStudyPlanner = lazyWithRetry(() => import("./pages/academy/AcademyStudyPlanner"));
const AcademyMyCourses = lazyWithRetry(() => import("./pages/academy/AcademyMyCourses"));
const AcademyMyWork = lazyWithRetry(() => import("./pages/academy/AcademyMyWork"));
const AcademySettings = lazyWithRetry(() => import("./pages/academy/AcademySettings"));
const AdminInstructorApplications = lazyWithRetry(() => import("./pages/admin/AdminInstructorApplications"));
const AdminLibraryResources = lazyWithRetry(() => import("./pages/admin/AdminLibraryResources"));
const AdminScholarships = lazyWithRetry(() => import("./pages/admin/AdminScholarships"));
const AdminAcademyHub = lazyWithRetry(() => import("./pages/admin/AdminAcademyHub"));
const AdminAcademyStudents = lazyWithRetry(() => import("./pages/admin/AdminAcademyStudents"));
const AdminAcademyGamification = lazyWithRetry(() => import("./pages/admin/AdminAcademyGamification"));
const AdminAcademyAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAcademyAnalytics"));
const AdminUniversities = lazyWithRetry(() => import("./pages/admin/AdminUniversities"));
const Game2048 = lazyWithRetry(() => import("./pages/games/expansion/Game2048"));
const Minesweeper = lazyWithRetry(() => import("./pages/games/expansion/Minesweeper"));
const ConnectFour = lazyWithRetry(() => import("./pages/games/expansion/ConnectFour"));
const ReactionTest = lazyWithRetry(() => import("./pages/games/expansion/ReactionTest"));
const TicTacToe = lazyWithRetry(() => import("./pages/games/expansion/TicTacToe"));
const TypingSpeed = lazyWithRetry(() => import("./pages/games/expansion/TypingSpeed"));
const MathChallenge = lazyWithRetry(() => import("./pages/games/expansion/MathChallenge"));
const SimonSays = lazyWithRetry(() => import("./pages/games/expansion/SimonSays"));
const KnowledgeQuiz = lazyWithRetry(() => import("./pages/games/expansion/KnowledgeQuiz"));
const BlindMaze = lazyWithRetry(() => import("./pages/games/expansion/BlindMaze"));
const Sudoku = lazyWithRetry(() => import("./pages/games/expansion/Sudoku"));
const Nonogram = lazyWithRetry(() => import("./pages/games/expansion/Nonogram"));
const Mastermind = lazyWithRetry(() => import("./pages/games/expansion/Mastermind"));
const WordSearch = lazyWithRetry(() => import("./pages/games/expansion/WordSearch"));
const ColorMatch = lazyWithRetry(() => import("./pages/games/expansion/ColorMatch"));
const AudioDirection = lazyWithRetry(() => import("./pages/games/expansion/AudioDirection"));
const Reversi = lazyWithRetry(() => import("./pages/games/expansion/Reversi"));
const Checkers = lazyWithRetry(() => import("./pages/games/expansion/Checkers"));
const PegSolitaire = lazyWithRetry(() => import("./pages/games/expansion/PegSolitaire"));
const Battleship = lazyWithRetry(() => import("./pages/games/expansion/Battleship"));
const MiniGolf = lazyWithRetry(() => import("./pages/games/expansion/MiniGolf"));
const Bowling = lazyWithRetry(() => import("./pages/games/expansion/Bowling"));
const Archery = lazyWithRetry(() => import("./pages/games/expansion/Archery"));
const Darts = lazyWithRetry(() => import("./pages/games/expansion/Darts"));
const AirportManager = lazyWithRetry(() => import("./pages/games/expansion/AirportManager"));
const TrafficControl = lazyWithRetry(() => import("./pages/games/expansion/TrafficControl"));
const TrainDispatcher = lazyWithRetry(() => import("./pages/games/expansion/TrainDispatcher"));
const HarborManager = lazyWithRetry(() => import("./pages/games/expansion/HarborManager"));
const LearnLetters = lazyWithRetry(() => import("./pages/games/expansion/LearnLetters"));
const LearnNumbers = lazyWithRetry(() => import("./pages/games/expansion/LearnNumbers"));
const LearnShapes = lazyWithRetry(() => import("./pages/games/expansion/LearnShapes"));
const MatchingStudio = lazyWithRetry(() => import("./pages/games/expansion/MatchingStudio"));
const Crossword = lazyWithRetry(() => import("./pages/games/expansion/Crossword"));
const AnagramArena = lazyWithRetry(() => import("./pages/games/expansion/AnagramArena"));
const WordLadder = lazyWithRetry(() => import("./pages/games/expansion/WordLadder"));
const SpellingMaster = lazyWithRetry(() => import("./pages/games/expansion/SpellingMaster"));
const RestaurantManager = lazyWithRetry(() => import("./pages/games/expansion/RestaurantManager"));
const FarmManager = lazyWithRetry(() => import("./pages/games/expansion/FarmManager"));
const ArcadeCityBuilder = lazyWithRetry(() => import("./pages/games/expansion/CityBuilder"));
const DeliverySimulator = lazyWithRetry(() => import("./pages/games/expansion/DeliverySimulator"));
const Snake = lazyWithRetry(() => import("./pages/games/expansion/Snake"));
const BlockStacker = lazyWithRetry(() => import("./pages/games/expansion/BlockStacker"));
const Breakout = lazyWithRetry(() => import("./pages/games/expansion/Breakout"));
const BubbleShooter = lazyWithRetry(() => import("./pages/games/expansion/BubbleShooter"));
const AudioMemory = lazyWithRetry(() => import("./pages/games/expansion/AudioMemory"));
const SoundHunt = lazyWithRetry(() => import("./pages/games/expansion/SoundHunt"));
const EchoLocator = lazyWithRetry(() => import("./pages/games/expansion/EchoLocator"));
const RhythmNavigation = lazyWithRetry(() => import("./pages/games/expansion/RhythmNavigation"));
const BalanceLab = lazyWithRetry(() => import("./pages/games/expansion/BalanceLab"));
const PendulumPuzzle = lazyWithRetry(() => import("./pages/games/expansion/PendulumPuzzle"));
const TrajectoryMaster = lazyWithRetry(() => import("./pages/games/expansion/TrajectoryMaster"));
const MagnetLab = lazyWithRetry(() => import("./pages/games/expansion/MagnetLab"));
const PenaltyShootout = lazyWithRetry(() => import("./pages/games/expansion/PenaltyShootout"));
const BasketballChallenge = lazyWithRetry(() => import("./pages/games/expansion/BasketballChallenge"));
const TableTennis = lazyWithRetry(() => import("./pages/games/expansion/TableTennis"));
const AirHockey = lazyWithRetry(() => import("./pages/games/expansion/AirHockey"));
const RhythmKeys = lazyWithRetry(() => import("./pages/games/expansion/RhythmKeys"));
const MelodyMemory = lazyWithRetry(() => import("./pages/games/expansion/MelodyMemory"));
const BeatMatcher = lazyWithRetry(() => import("./pages/games/expansion/BeatMatcher"));
const PianoTrainer = lazyWithRetry(() => import("./pages/games/expansion/PianoTrainer"));
const SymmetrySketch = lazyWithRetry(() => import("./pages/games/expansion/SymmetrySketch"));
const PixelCanvas = lazyWithRetry(() => import("./pages/games/expansion/PixelCanvas"));
const ShapeDesigner = lazyWithRetry(() => import("./pages/games/expansion/ShapeDesigner"));
const PatternArtist = lazyWithRetry(() => import("./pages/games/expansion/PatternArtist"));
const LemonadeStand = lazyWithRetry(() => import("./pages/games/expansion/LemonadeStand"));
const SpaceMinerIdle = lazyWithRetry(() => import("./pages/games/expansion/SpaceMinerIdle"));
const FactoryIdle = lazyWithRetry(() => import("./pages/games/expansion/FactoryIdle"));
const AquariumKeeper = lazyWithRetry(() => import("./pages/games/expansion/AquariumKeeper"));
const GardenPlanner = lazyWithRetry(() => import("./pages/games/expansion/GardenPlanner"));
const MuseumCurator = lazyWithRetry(() => import("./pages/games/expansion/MuseumCurator"));
const WildlifeRescue = lazyWithRetry(() => import("./pages/games/expansion/WildlifeRescue"));
const Solitaire = lazyWithRetry(() => import("./pages/games/expansion/Solitaire"));
const SpiderSolitaire = lazyWithRetry(() => import("./pages/games/expansion/SpiderSolitaire"));
const FreeCell = lazyWithRetry(() => import("./pages/games/expansion/FreeCell"));
const Mahjong = lazyWithRetry(() => import("./pages/games/expansion/Mahjong"));
const TowerDefense = lazyWithRetry(() => import("./pages/games/expansion/TowerDefense"));
const MazeRunner = lazyWithRetry(() => import("./pages/games/expansion/MazeRunner"));
const ParkingChallenge = lazyWithRetry(() => import("./pages/games/expansion/ParkingChallenge"));
const EscapeRoom = lazyWithRetry(() => import("./pages/games/expansion/EscapeRoom"));
const Hex = lazyWithRetry(() => import("./pages/games/expansion/Hex"));
const Mancala = lazyWithRetry(() => import("./pages/games/expansion/Mancala"));
const RoyalGameOfUr = lazyWithRetry(() => import("./pages/games/expansion/RoyalGameOfUr"));

// Library — books/audiobooks section (Phase 1 architecture prep, distinct from academy/library)
const LibraryHome = lazyWithRetry(() => import("./pages/library/LibraryHome"));
const LibraryCategories = lazyWithRetry(() => import("./pages/library/LibraryCategories"));
const LibraryCategoryDetails = lazyWithRetry(() => import("./pages/library/LibraryCategoryDetails"));
const LibraryBooksExplorer = lazyWithRetry(() => import("./pages/library/LibraryBooksExplorer"));
const LibraryBookDetails = lazyWithRetry(() => import("./pages/library/LibraryBookDetails"));
const LibraryReader = lazyWithRetry(() => import("./pages/library/LibraryReader"));
const LibraryAudiobooks = lazyWithRetry(() => import("./pages/library/LibraryAudiobooks"));
const LibraryAudiobookPlayer = lazyWithRetry(() => import("./pages/library/LibraryAudiobookPlayer"));
const LibraryAuthors = lazyWithRetry(() => import("./pages/library/LibraryAuthors"));
const LibraryAuthorProfile = lazyWithRetry(() => import("./pages/library/LibraryAuthorProfile"));
const LibrarySearch = lazyWithRetry(() => import("./pages/library/LibrarySearch"));
const LibraryQuotes = lazyWithRetry(() => import("./pages/library/LibraryQuotes"));
const LibraryMyLibrary = lazyWithRetry(() => import("./pages/library/LibraryMyLibrary"));
const LibraryReadingLists = lazyWithRetry(() => import("./pages/library/LibraryReadingLists"));
const LibraryFavorites = lazyWithRetry(() => import("./pages/library/LibraryFavorites"));
const LibraryContinueReading = lazyWithRetry(() => import("./pages/library/LibraryContinueReading"));
const LibraryDownloads = lazyWithRetry(() => import("./pages/library/LibraryDownloads"));
const LibraryReviews = lazyWithRetry(() => import("./pages/library/LibraryReviews"));
const LibraryCommunity = lazyWithRetry(() => import("./pages/library/LibraryCommunity"));
const LibraryDashboard = lazyWithRetry(() => import("./pages/library/LibraryDashboard"));
const LibraryAdmin = lazyWithRetry(() => import("./pages/library/LibraryAdmin"));

// Book Marketplace (Phase 10) — public storefront pages, plus one
// personal (AuthGuard) wishlist page.
const LibraryWishlistPage = lazyWithRetry(() => import("./pages/library/LibraryWishlistPage"));
const LibraryPublisherProfile = lazyWithRetry(() => import("./pages/library/LibraryPublisherProfile"));
const LibraryCollectionDetail = lazyWithRetry(() => import("./pages/library/LibraryCollectionDetail"));
const LibrarySeriesDetail = lazyWithRetry(() => import("./pages/library/LibrarySeriesDetail"));
const LibraryBundleDetail = lazyWithRetry(() => import("./pages/library/LibraryBundleDetail"));

// Library Author Publishing Studio (Phase 9) — distinct from the reader-side
// pages above; the author-facing dashboard/creation/editor/collaboration
// surface, gated by AuthGuard (not AdminRoute — any signed-in user can
// become an author via the self-service flow).
const LibraryStudioDashboard = lazyWithRetry(() => import("./pages/library/studio/LibraryStudioDashboard"));
const LibraryBecomeAuthor = lazyWithRetry(() => import("./pages/library/studio/LibraryBecomeAuthor"));
const LibraryStudioBookWizard = lazyWithRetry(() => import("./pages/library/studio/LibraryStudioBookWizard"));
const LibraryStudioBookOverview = lazyWithRetry(() => import("./pages/library/studio/LibraryStudioBookOverview"));
const LibraryStudioEditor = lazyWithRetry(() => import("./pages/library/studio/LibraryStudioEditor"));
const LibraryStudioAnalytics = lazyWithRetry(() => import("./pages/library/studio/LibraryStudioAnalytics"));

// Global Digital Library (Phase 11) — public-domain import review + curated
// collections admin (both AdminRoute-gated), and the public knowledge-graph
// navigator (browsing, no auth required — same as authors/categories/etc.).
const LibraryImportReview = lazyWithRetry(() => import("./pages/library/LibraryImportReview"));
const LibraryCollectionsAdmin = lazyWithRetry(() => import("./pages/library/LibraryCollectionsAdmin"));
const LibraryKnowledgeGraph = lazyWithRetry(() => import("./pages/library/LibraryKnowledgeGraph"));
const LibraryKnowledgeGraphEntity = lazyWithRetry(() => import("./pages/library/LibraryKnowledgeGraphEntity"));

// Knowledge & Research Platform (Phase 14) — knowledge maps, timelines, AI
// semantic search, the multi-book Research Assistant, and the Research
// Workspace (projects/collaboration). Public browsing where the underlying
// data is public (knowledge maps/timelines mirror the Knowledge Graph's own
// public-read rule); personal/collaborative surfaces enforced by RLS.
const LibraryKnowledgeMap = lazyWithRetry(() => import("./pages/library/LibraryKnowledgeMap"));
const LibraryTimelines = lazyWithRetry(() => import("./pages/library/LibraryTimelines"));
const LibraryTimelineDetail = lazyWithRetry(() => import("./pages/library/LibraryTimelineDetail"));
const LibraryAiSearch = lazyWithRetry(() => import("./pages/library/LibraryAiSearch"));
const LibraryResearchAssistant = lazyWithRetry(() => import("./pages/library/LibraryResearchAssistant"));
const LibraryResearchAnalysisDetail = lazyWithRetry(() => import("./pages/library/LibraryResearchAnalysisDetail"));
const LibraryResearchProjects = lazyWithRetry(() => import("./pages/library/LibraryResearchProjects"));
const LibraryResearchProjectDetail = lazyWithRetry(() => import("./pages/library/LibraryResearchProjectDetail"));
const LibraryAiInsights = lazyWithRetry(() => import("./pages/library/LibraryAiInsights"));

// AI Personal Librarian (Phase 15) — a unifying AI companion dashboard tying
// together data from every prior phase (profile, preferences, daily plans,
// goals, recommendations, chat, privacy). All personal, AuthGuard-ed.
const LibraryLibrarian = lazyWithRetry(() => import("./pages/library/LibraryLibrarian"));
const LibraryLibrarianProfile = lazyWithRetry(() => import("./pages/library/LibraryLibrarianProfile"));
const LibraryLibrarianChat = lazyWithRetry(() => import("./pages/library/LibraryLibrarianChat"));
const LibraryLibrarianSummaries = lazyWithRetry(() => import("./pages/library/LibraryLibrarianSummaries"));
const LibraryLibrarianPrivacy = lazyWithRetry(() => import("./pages/library/LibraryLibrarianPrivacy"));

// Enterprise & Organization Platform (Phase 17) — multi-tenant orgs (schools/
// universities/companies/government/NGOs/libraries) with member management,
// groups, private resource libraries, granular permissions, licensing,
// learning-management assignments, analytics/reports, and security settings.
// All personal/organizational, AuthGuard-ed.
const LibraryOrganizations = lazyWithRetry(() => import("./pages/library/LibraryOrganizations"));
const LibraryOrganizationDashboard = lazyWithRetry(() => import("./pages/library/LibraryOrganizationDashboard"));
const LibraryOrganizationMembers = lazyWithRetry(() => import("./pages/library/LibraryOrganizationMembers"));
const LibraryOrganizationGroups = lazyWithRetry(() => import("./pages/library/LibraryOrganizationGroups"));
const LibraryOrganizationResources = lazyWithRetry(() => import("./pages/library/LibraryOrganizationResources"));
const LibraryOrganizationPermissions = lazyWithRetry(() => import("./pages/library/LibraryOrganizationPermissions"));
const LibraryOrganizationLicenses = lazyWithRetry(() => import("./pages/library/LibraryOrganizationLicenses"));
const LibraryOrganizationAssignments = lazyWithRetry(() => import("./pages/library/LibraryOrganizationAssignments"));
const LibraryOrganizationAnalytics = lazyWithRetry(() => import("./pages/library/LibraryOrganizationAnalytics"));
const LibraryOrganizationSecurity = lazyWithRetry(() => import("./pages/library/LibraryOrganizationSecurity"));

// Reading Community (Phase 12) — reader profiles, book clubs, discussions,
// events, and a leaderboard. Public browsing (profiles/clubs respect their
// own visibility/privacy rules server-side), personal actions AuthGuard-ed.
const LibraryReaderProfile = lazyWithRetry(() => import("./pages/library/LibraryReaderProfile"));
const LibraryClubs = lazyWithRetry(() => import("./pages/library/LibraryClubs"));
const LibraryClubDetail = lazyWithRetry(() => import("./pages/library/LibraryClubDetail"));
const LibraryDiscussionTopic = lazyWithRetry(() => import("./pages/library/LibraryDiscussionTopic"));
const LibraryChallenges = lazyWithRetry(() => import("./pages/library/LibraryChallenges"));
const LibraryEvents = lazyWithRetry(() => import("./pages/library/LibraryEvents"));
const LibraryLeaderboard = lazyWithRetry(() => import("./pages/library/LibraryLeaderboard"));

// Learning Hub (Phase 13) — learning paths, flashcards, quizzes, AI study
// assistant, analytics, and certificates. Certificate verification is
// public (no auth required — anyone with a certificate number can confirm
// authenticity); everything else is personal, AuthGuard-ed.
const LibraryLearningPaths = lazyWithRetry(() => import("./pages/library/LibraryLearningPaths"));
const LibraryLearningPathDetail = lazyWithRetry(() => import("./pages/library/LibraryLearningPathDetail"));
const LibraryFlashcards = lazyWithRetry(() => import("./pages/library/LibraryFlashcards"));
const LibraryFlashcardStudyDeck = lazyWithRetry(() => import("./pages/library/LibraryFlashcardStudyDeck"));
const LibraryQuizTake = lazyWithRetry(() => import("./pages/library/LibraryQuizTake"));
const LibraryStudyAssistant = lazyWithRetry(() => import("./pages/library/LibraryStudyAssistant"));
const LibraryLearningAnalytics = lazyWithRetry(() => import("./pages/library/LibraryLearningAnalytics"));
const LibraryCertificates = lazyWithRetry(() => import("./pages/library/LibraryCertificates"));
const LibraryCertificateVerify = lazyWithRetry(() => import("./pages/library/LibraryCertificateVerify"));

const Content = lazyWithRetry(() => import("./pages/Content"));
const ContactUs = lazyWithRetry(() => import("./pages/ContactUs"));
const Leaderboard = lazyWithRetry(() => import("./pages/Leaderboard"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ProductDetail = lazyWithRetry(() => import("./pages/ProductDetail"));
const Wishlist = lazyWithRetry(() => import("./pages/Wishlist"));
const Games = lazyWithRetry(() => import("./pages/Games"));
const VisionexKids = lazyWithRetry(() => import("./pages/VisionexKids"));
const AccessibleGames = lazyWithRetry(() => import("./pages/AccessibleGames"));
const ArcadePlayerHub = lazyWithRetry(() => import("./pages/ArcadePlayerHub"));
const QuizChallenge = lazyWithRetry(() => import("./pages/QuizChallenge"));
const MemoryGame = lazyWithRetry(() => import("./pages/MemoryGame"));
const WordPuzzle = lazyWithRetry(() => import("./pages/WordPuzzle"));
const Visionopoly = lazyWithRetry(() => import("./pages/games/Visionopoly"));
const Chess = lazyWithRetry(() => import("./pages/games/Chess"));
const Backgammon = lazyWithRetry(() => import("./pages/games/Backgammon"));
const Ludo = lazyWithRetry(() => import("./pages/games/Ludo"));
const WordMaster = lazyWithRetry(() => import("./pages/games/WordMaster"));
const SkyboundQuest = lazyWithRetry(() => import("./pages/games/SkyboundQuest"));
const AssistiveProducts = lazyWithRetry(() => import("./pages/AssistiveProducts"));
const BusinessSimulator = lazyWithRetry(() => import("./pages/BusinessSimulator"));
const SimulationRunner = lazyWithRetry(() => import("./pages/SimulationRunner"));
const SimulationsSummary = lazyWithRetry(() => import("./pages/SimulationsSummary"));
const Delivery = lazyWithRetry(() => import("./pages/Delivery"));
const TripHistory = lazyWithRetry(() => import("./pages/TripHistory"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const SharedTrip = lazyWithRetry(() => import("./pages/SharedTrip"));
const BusinessEconomy = lazyWithRetry(() => import("./pages/BusinessEconomy"));
const NutritionExpert = lazyWithRetry(() => import("./pages/NutritionExpert"));
const Community = lazyWithRetry(() => import("./pages/Community"));
const VoiceRoom = lazyWithRetry(() => import("./pages/community/VoiceRoom"));
const VoiceRooms = lazyWithRetry(() => import("./pages/community/VoiceRooms"));
const CoinsStore = lazyWithRetry(() => import("./pages/CoinsStore"));
const News = lazyWithRetry(() => import("./pages/News"));
const NewsletterPreferences = lazyWithRetry(() => import("./pages/NewsletterPreferences"));
const Messages = lazyWithRetry(() => import("./pages/Messages"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const ProfessionalTools = lazyWithRetry(() => import("./pages/ProfessionalTools"));
const ToolDetail = lazyWithRetry(() => import("./pages/ToolDetail"));

const Careers = lazyWithRetry(() => import("./pages/Careers"));
const CareerDashboard = lazyWithRetry(() => import("./pages/career/CareerDashboard"));
const AICareerSuite = lazyWithRetry(() => import("./pages/career/AICareerSuite"));
const EmployerDashboard = lazyWithRetry(() => import("./pages/career/EmployerDashboard"));
const JobIntelligence = lazyWithRetry(() => import("./pages/career/JobIntelligence"));
const CareerAgent = lazyWithRetry(() => import("./pages/career/CareerAgent"));
const CareerNetwork = lazyWithRetry(() => import("./pages/career/CareerNetwork"));
const CareerCommunity = lazyWithRetry(() => import("./pages/career/CareerCommunity"));

// New service pages
const CareerHub = lazyWithRetry(() => import("./pages/services/CareerHub"));
const MusicConservatory = lazyWithRetry(() => import("./pages/services/MusicConservatory"));
const GlobalStudio = lazyWithRetry(() => import("./pages/services/GlobalStudio"));
const WebDesign = lazyWithRetry(() => import("./pages/services/WebDesign"));
const DigitalMarketing = lazyWithRetry(() => import("./pages/services/DigitalMarketing"));
const ImportPurchasing = lazyWithRetry(() => import("./pages/services/ImportPurchasing"));
const TechConsulting = lazyWithRetry(() => import("./pages/services/TechConsulting"));
const TrainingService = lazyWithRetry(() => import("./pages/services/Training"));
const HairCare = lazyWithRetry(() => import("./pages/services/HairCare"));
const LegalAdvisor = lazyWithRetry(() => import("./pages/services/LegalAdvisor"));
const MedicalSupport = lazyWithRetry(() => import("./pages/services/MedicalSupport"));
const Psychology = lazyWithRetry(() => import("./pages/services/Psychology"));
const SkinCareExpert = lazyWithRetry(() => import("./pages/services/SkinCareExpert"));
const SocialGuide = lazyWithRetry(() => import("./pages/services/SocialGuide"));
const SportsCoach = lazyWithRetry(() => import("./pages/services/SportsCoach"));
const TravelAgency = lazyWithRetry(() => import("./pages/services/TravelAgency"));
const RadarAI = lazyWithRetry(() => import("./pages/services/RadarAI"));
const EducationalEmpire = lazyWithRetry(() => import("./pages/services/EducationalEmpire"));
const EmpathyOasis = lazyWithRetry(() => import("./pages/services/EmpathyOasis"));
const OCRScan = lazyWithRetry(() => import("./pages/services/OCRScan"));
const FileStudio = lazyWithRetry(() => import("./pages/services/FileStudio"));
const LiveTV          = lazyWithRetry(() => import("./pages/services/LiveTV"));
const LiveTVWatch     = lazyWithRetry(() => import("./pages/services/LiveTVWatch"));
const LiveTVSubscribe = lazyWithRetry(() => import("./pages/services/LiveTVSubscribe"));
const LiveTVFavorites = lazyWithRetry(() => import("./pages/services/LiveTVFavorites"));
const LiveTVSearch    = lazyWithRetry(() => import("./pages/services/LiveTVSearch"));
const LiveTVPlaylists = lazyWithRetry(() => import("./pages/services/LiveTVPlaylists"));
const StreamingGuide = lazyWithRetry(() => import("./pages/services/StreamingGuide"));
const LiveRadio = lazyWithRetry(() => import("./pages/services/LiveRadio"));
const LiveRadioListen = lazyWithRetry(() => import("./pages/services/LiveRadioListen"));
const LiveRadioSubscribe = lazyWithRetry(() => import("./pages/services/LiveRadioSubscribe"));

// AI Media Studio
const AIMediaStudio = lazyWithRetry(() => import("./pages/services/ai-media-studio/index"));
const AIMediaStudioProjects = lazyWithRetry(() => import("./pages/services/ai-media-studio/Projects"));
const AIMediaStudioAssets = lazyWithRetry(() => import("./pages/services/ai-media-studio/Assets"));
const AIMediaStudioTemplates = lazyWithRetry(() => import("./pages/services/ai-media-studio/Templates"));
const AIMediaStudioSettings = lazyWithRetry(() => import("./pages/services/ai-media-studio/Settings"));
const AIMediaStudioHelp = lazyWithRetry(() => import("./pages/services/ai-media-studio/Help"));
const AIMediaStudioSpeech = lazyWithRetry(() => import("./pages/services/ai-media-studio/SpeechStudio"));
const AIMediaStudioVoice  = lazyWithRetry(() => import("./pages/services/ai-media-studio/VoiceStudio"));
const AIMediaStudioVideo       = lazyWithRetry(() => import("./pages/services/ai-media-studio/VideoStudio"));
const AIMediaStudioProviderHub  = lazyWithRetry(() => import("./pages/services/ai-media-studio/ProviderHub"));
const AIMediaStudioBilling      = lazyWithRetry(() => import("./pages/services/ai-media-studio/Billing"));
const AIMediaStudioImage        = lazyWithRetry(() => import("./pages/services/ai-media-studio/ImageStudio"));
const AIMediaStudioDiagnostics  = lazyWithRetry(() => import("./pages/services/ai-media-studio/Diagnostics"));
const AIMediaStudioDocument     = lazyWithRetry(() => import("./pages/services/ai-media-studio/DocumentStudio"));
const AIMediaStudioTextTools    = lazyWithRetry(() => import("./pages/services/ai-media-studio/TextToolsStudio"));

// New game pages
const Hangman = lazyWithRetry(() => import("./pages/games/Hangman"));
const Dominoes = lazyWithRetry(() => import("./pages/games/Dominoes"));
const FarkleGame = lazyWithRetry(() => import("./pages/games/FarkleGame"));
const JungleSurvival = lazyWithRetry(() => import("./pages/games/JungleSurvival"));
const StarChef = lazyWithRetry(() => import("./pages/games/StarChef"));
const UnoUltra = lazyWithRetry(() => import("./pages/games/UnoUltra"));
const NeonBreach = lazyWithRetry(() => import("./pages/games/NeonBreach"));
const LogiQuest = lazyWithRetry(() => import("./pages/games/LogiQuest"));
const TradeTycoon = lazyWithRetry(() => import("./pages/games/TradeTycoon"));
const TacticalStrike = lazyWithRetry(() => import("./pages/games/TacticalStrike"));
const Briscola = lazyWithRetry(() => import("./pages/games/Briscola"));
const Card99 = lazyWithRetry(() => import("./pages/games/Card99"));
const DreamHome = lazyWithRetry(() => import("./pages/games/DreamHome"));
const LaptopTechMaster = lazyWithRetry(() => import("./pages/games/LaptopTechMaster"));
const MusicEarMaster = lazyWithRetry(() => import("./pages/games/MusicEarMaster"));
const FashionDesigner = lazyWithRetry(() => import("./pages/games/FashionDesigner"));
const VelocityXRacing = lazyWithRetry(() => import("./pages/games/VelocityXRacing"));
const Akinator = lazyWithRetry(() => import("./pages/games/Akinator"));
const ArcadeEconomy = lazyWithRetry(() => import("./pages/ArcadeEconomy"));

// ── Visionex Finance ──────────────────────────────────────────────────────────
const FinanceDashboard   = lazyWithRetry(() => import("./pages/finance/FinanceDashboard"));
const FinanceMarkets     = lazyWithRetry(() => import("./pages/finance/Markets"));
const FinanceStocks      = lazyWithRetry(() => import("./pages/finance/Stocks"));
const FinanceCurrencies  = lazyWithRetry(() => import("./pages/finance/Currencies"));
const FinanceCommodities = lazyWithRetry(() => import("./pages/finance/Commodities"));
const FinancePortfolio   = lazyWithRetry(() => import("./pages/finance/Portfolio"));
const FinanceWatchlist   = lazyWithRetry(() => import("./pages/finance/Watchlist"));
const FinanceAIAnalyst   = lazyWithRetry(() => import("./pages/finance/AIAnalyst"));
const FinanceCalendar    = lazyWithRetry(() => import("./pages/finance/EconomicCalendar"));
const FinanceNews        = lazyWithRetry(() => import("./pages/finance/MarketNews"));
const FinanceAffiliate   = lazyWithRetry(() => import("./pages/finance/AffiliateCenter"));
const FinanceBrokers     = lazyWithRetry(() => import("./pages/finance/BrokerComparison"));
const FinanceAcademy     = lazyWithRetry(() => import("./pages/finance/FinanceAcademy"));

// Legal pages
const LegalCenter = lazyWithRetry(() => import("./pages/legal/LegalCenter"));

// Admin pages
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminInfra     = lazyWithRetry(() => import("./pages/admin/AdminInfra"));
const AdminNews = lazyWithRetry(() => import("./pages/admin/AdminNews"));
const AdminProducts = lazyWithRetry(() => import("./pages/admin/AdminProducts"));
const AdminContent = lazyWithRetry(() => import("./pages/admin/AdminContent"));
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const AdminRequests = lazyWithRetry(() => import("./pages/admin/AdminRequests"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminSubscribers = lazyWithRetry(() => import("./pages/admin/AdminSubscribers"));
const AdminModeration = lazyWithRetry(() => import("./pages/admin/AdminModeration"));
const AdminEmails = lazyWithRetry(() => import("./pages/admin/AdminEmails"));
const AdminDatabase = lazyWithRetry(() => import("./pages/admin/AdminDatabase"));
const AdminLogs = lazyWithRetry(() => import("./pages/admin/AdminLogs"));
const AdminVX   = lazyWithRetry(() => import("./pages/admin/AdminVX"));
const AdminVXCoinOrders = lazyWithRetry(() => import("./pages/admin/AdminVXCoinOrders"));
const AdminSimulations = lazyWithRetry(() => import("./pages/admin/AdminSimulations"));
const AdminBazaar = lazyWithRetry(() => import("./pages/admin/AdminBazaar"));
const AdminTV = lazyWithRetry(() => import("./pages/admin/AdminTV"));
const AdminRadio = lazyWithRetry(() => import("./pages/admin/AdminRadio"));
const AdminNotifications = lazyWithRetry(() => import("./pages/admin/AdminNotifications"));
const AdminArcadeEconomy = lazyWithRetry(() => import("./pages/admin/AdminArcadeEconomy"));

// VisionKids — accessibility-first kids' hub, independent layout/nav from the rest of the site.
const VisionKidsLayout = lazyWithRetry(() => import("./features/visionkids/layouts/VisionKidsLayout"));
const VisionKidsHome = lazyWithRetry(() => import("./features/visionkids/pages/VisionKidsHome"));
const VisionKidsSettings = lazyWithRetry(() => import("./features/visionkids/pages/VisionKidsSettings"));
const VisionKidsSection = lazyWithRetry(() => import("./features/visionkids/pages/VisionKidsSection"));
const AiTeacherHome = lazyWithRetry(() => import("./features/visionkids/pages/aiTeacher/AiTeacherHome"));

// VisionKids Phase 2 — Smart Stories Library
const StoriesHome = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoriesHome"));
const StoryCategories = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryCategories"));
const StoryBrowse = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryBrowse"));
const StoryDetails = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryDetails"));
const StoryReader = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryReader"));
const StoryAudioPlayer = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryAudioPlayer"));
const StoryQuizPage = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryQuizPage"));
const StoryFavorites = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryFavorites"));
const StoryDownloads = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryDownloads"));
const StoryContinueReading = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryContinueReading"));
const StoryHistory = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryHistory"));
const StoryRecommended = lazyWithRetry(() => import("./features/visionkids/pages/stories/StoryRecommended"));
const AiStories = lazyWithRetry(() => import("./features/visionkids/pages/stories/AiStories"));
const AiStoryCreate = lazyWithRetry(() => import("./features/visionkids/pages/stories/AiStoryCreate"));
const AiStoryDetail = lazyWithRetry(() => import("./features/visionkids/pages/stories/AiStoryDetail"));

// VisionKids Phase 3 — Educational Games Platform
const GamesHome = lazyWithRetry(() => import("./features/visionkids/pages/games/GamesHome"));
const GameCategories = lazyWithRetry(() => import("./features/visionkids/pages/games/GameCategories"));
const GameBrowse = lazyWithRetry(() => import("./features/visionkids/pages/games/GameBrowse"));
const GameDetails = lazyWithRetry(() => import("./features/visionkids/pages/games/GameDetails"));
const GamePlay = lazyWithRetry(() => import("./features/visionkids/pages/games/GamePlay"));
const RecentlyPlayed = lazyWithRetry(() => import("./features/visionkids/pages/games/RecentlyPlayed"));
const GameFavorites = lazyWithRetry(() => import("./features/visionkids/pages/games/GameFavorites"));
const Achievements = lazyWithRetry(() => import("./features/visionkids/pages/games/Achievements"));
const GamesLeaderboard = lazyWithRetry(() => import("./features/visionkids/pages/games/Leaderboard"));
const DailyChallenges = lazyWithRetry(() => import("./features/visionkids/pages/games/DailyChallenges"));
const WeeklyChallenges = lazyWithRetry(() => import("./features/visionkids/pages/games/WeeklyChallenges"));
const MultiplayerLobby = lazyWithRetry(() => import("./features/visionkids/pages/games/MultiplayerLobby"));
const MultiplayerRoomView = lazyWithRetry(() => import("./features/visionkids/pages/games/MultiplayerRoomView"));
const GameProfile = lazyWithRetry(() => import("./features/visionkids/pages/games/GameProfile"));

// VisionKids Phase 4 — Academy
const AcademyHome = lazyWithRetry(() => import("./features/visionkids/pages/academy/AcademyHome"));
const AcademySubjects = lazyWithRetry(() => import("./features/visionkids/pages/academy/Subjects"));
const SubjectCourses = lazyWithRetry(() => import("./features/visionkids/pages/academy/SubjectCourses"));
const CourseDetail = lazyWithRetry(() => import("./features/visionkids/pages/academy/CourseDetail"));
const LessonPlayer = lazyWithRetry(() => import("./features/visionkids/pages/academy/LessonPlayer"));
const AcademyHomework = lazyWithRetry(() => import("./features/visionkids/pages/academy/Homework"));
const AcademyProjects = lazyWithRetry(() => import("./features/visionkids/pages/academy/Projects"));
const ProjectSubmit = lazyWithRetry(() => import("./features/visionkids/pages/academy/ProjectSubmit"));
const AcademyExams = lazyWithRetry(() => import("./features/visionkids/pages/academy/Exams"));
const KidsAcademyCertificates = lazyWithRetry(() => import("./features/visionkids/pages/academy/Certificates"));
const CertificateVerify = lazyWithRetry(() => import("./features/visionkids/pages/academy/CertificateVerify"));
const ParentsDashboard = lazyWithRetry(() => import("./features/visionkids/pages/academy/ParentsDashboard"));
const TeacherDashboard = lazyWithRetry(() => import("./features/visionkids/pages/academy/TeacherDashboard"));
const TeacherCourseManage = lazyWithRetry(() => import("./features/visionkids/pages/academy/TeacherCourseManage"));
const LearningAnalytics = lazyWithRetry(() => import("./features/visionkids/pages/academy/LearningAnalytics"));
const LearningPath = lazyWithRetry(() => import("./features/visionkids/pages/academy/LearningPath"));
const AcademyDownloads = lazyWithRetry(() => import("./features/visionkids/pages/academy/Downloads"));

// VisionKids Phase 5 — AI Creative Studio
const StudioHome = lazyWithRetry(() => import("./features/visionkids/pages/studio/StudioHome"));
const DrawingStudio = lazyWithRetry(() => import("./features/visionkids/pages/studio/DrawingStudio"));
const CharacterBuilder = lazyWithRetry(() => import("./features/visionkids/pages/studio/CharacterBuilder"));
const StickerMaker = lazyWithRetry(() => import("./features/visionkids/pages/studio/StickerMaker"));
const MusicStudio = lazyWithRetry(() => import("./features/visionkids/pages/studio/MusicStudio"));
const VoiceStudio = lazyWithRetry(() => import("./features/visionkids/pages/studio/VoiceStudio"));
const CartoonCreator = lazyWithRetry(() => import("./features/visionkids/pages/studio/CartoonCreator"));
const ComicCreator = lazyWithRetry(() => import("./features/visionkids/pages/studio/ComicCreator"));
const BookCreator = lazyWithRetry(() => import("./features/visionkids/pages/studio/BookCreator"));
const VideoCreator = lazyWithRetry(() => import("./features/visionkids/pages/studio/VideoCreator"));
const StudioGallery = lazyWithRetry(() => import("./features/visionkids/pages/studio/StudioGallery"));
const StudioTemplates = lazyWithRetry(() => import("./features/visionkids/pages/studio/StudioTemplates"));
const CreativeChallenges = lazyWithRetry(() => import("./features/visionkids/pages/studio/CreativeChallenges"));
const MyProjects = lazyWithRetry(() => import("./features/visionkids/pages/studio/MyProjects"));

// VisionKids Phase 6 — Explorer
const ExplorerHome = lazyWithRetry(() => import("./features/visionkids/pages/explorer/ExplorerHome"));
const VirtualWorld = lazyWithRetry(() => import("./features/visionkids/pages/explorer/VirtualWorld"));
const ExplorerWorldListPage = lazyWithRetry(() => import("./features/visionkids/pages/explorer/WorldListPage"));
const ExplorerLocationDetailPage = lazyWithRetry(() => import("./features/visionkids/pages/explorer/LocationDetailPage"));
const ExplorerLocationQuizPage = lazyWithRetry(() => import("./features/visionkids/pages/explorer/LocationQuizPage"));
const ExplorerPassport = lazyWithRetry(() => import("./features/visionkids/pages/explorer/ExplorerPassport"));
const SpaceMission = lazyWithRetry(() => import("./features/visionkids/pages/explorer/SpaceMission"));
const CityBuilder = lazyWithRetry(() => import("./features/visionkids/pages/explorer/CityBuilder"));
const FarmSimulator = lazyWithRetry(() => import("./features/visionkids/pages/explorer/FarmSimulator"));
const EcoWorld = lazyWithRetry(() => import("./features/visionkids/pages/explorer/EcoWorld"));

// VisionKids Phase 7 — Social & Parents Hub
const CommunityHome = lazyWithRetry(() => import("./features/visionkids/pages/social/CommunityHome"));
const SocialFriends = lazyWithRetry(() => import("./features/visionkids/pages/social/Friends"));
const SocialChallengesHub = lazyWithRetry(() => import("./features/visionkids/pages/social/ChallengesHub"));
const SocialNotifications = lazyWithRetry(() => import("./features/visionkids/pages/social/Notifications"));
const SocialReports = lazyWithRetry(() => import("./features/visionkids/pages/social/Reports"));
const ClubListPage = lazyWithRetry(() => import("./features/visionkids/pages/social/ClubListPage"));
const ClubDetailPage = lazyWithRetry(() => import("./features/visionkids/pages/social/ClubDetailPage"));
const ClubQuizPage = lazyWithRetry(() => import("./features/visionkids/pages/social/ClubQuizPage"));
const SafeChatHome = lazyWithRetry(() => import("./features/visionkids/pages/social/SafeChatHome"));
const ChatThread = lazyWithRetry(() => import("./features/visionkids/pages/social/ChatThread"));
const VoiceRoomLobby = lazyWithRetry(() => import("./features/visionkids/pages/social/VoiceRoomLobby"));
const VoiceRoomLive = lazyWithRetry(() => import("./features/visionkids/pages/social/VoiceRoomLive"));
const SocialSettings = lazyWithRetry(() => import("./features/visionkids/pages/social/SocialSettings"));
const ModerationPanel = lazyWithRetry(() => import("./features/visionkids/pages/social/ModerationPanel"));
const FamilyAccounts = lazyWithRetry(() => import("./features/visionkids/pages/social/FamilyAccounts"));
const SocialParentsDashboard = lazyWithRetry(() => import("./features/visionkids/pages/social/ParentsDashboard"));
const SocialActivityTimeline = lazyWithRetry(() => import("./features/visionkids/pages/social/ActivityTimeline"));
const SocialParentSettings = lazyWithRetry(() => import("./features/visionkids/pages/social/ParentSettings"));

// VisionKids Phase 8 — Live Events & Universe
const EventsHome = lazyWithRetry(() => import("./features/visionkids/pages/events/EventsHome"));
const EventListPage = lazyWithRetry(() => import("./features/visionkids/pages/events/EventListPage"));
const EventsCalendar = lazyWithRetry(() => import("./features/visionkids/pages/events/Calendar"));
const MyEvents = lazyWithRetry(() => import("./features/visionkids/pages/events/MyEvents"));
const EventNotifications = lazyWithRetry(() => import("./features/visionkids/pages/events/EventNotifications"));
const EventDetails = lazyWithRetry(() => import("./features/visionkids/pages/events/EventDetails"));
const EventRegistration = lazyWithRetry(() => import("./features/visionkids/pages/events/Registration"));
const LiveEventRoom = lazyWithRetry(() => import("./features/visionkids/pages/events/LiveEventRoom"));
const ReplayLibrary = lazyWithRetry(() => import("./features/visionkids/pages/events/ReplayLibrary"));
const ReplayPlayer = lazyWithRetry(() => import("./features/visionkids/pages/events/ReplayPlayer"));
const EventsRewardsCenter = lazyWithRetry(() => import("./features/visionkids/pages/events/RewardsCenter"));
const EventCertificates = lazyWithRetry(() => import("./features/visionkids/pages/events/EventCertificates"));
const UniverseMap = lazyWithRetry(() => import("./features/visionkids/pages/events/UniverseMap"));
const UniverseCityDetail = lazyWithRetry(() => import("./features/visionkids/pages/events/CityDetail"));

// VisionKids Phase 9 — Talent Hub & Future Skills
const TalentHubHome = lazyWithRetry(() => import("./features/visionkids/pages/talent/TalentHubHome"));
const TalentAssessment = lazyWithRetry(() => import("./features/visionkids/pages/talent/TalentAssessment"));
const MyTalents = lazyWithRetry(() => import("./features/visionkids/pages/talent/MyTalents"));
const SkillTree = lazyWithRetry(() => import("./features/visionkids/pages/talent/SkillTree"));
const TalentFutureSkills = lazyWithRetry(() => import("./features/visionkids/pages/talent/FutureSkills"));
const FutureSkillDetail = lazyWithRetry(() => import("./features/visionkids/pages/talent/FutureSkillDetail"));
const TalentTrackDetail = lazyWithRetry(() => import("./features/visionkids/pages/talent/TrackDetail"));
const TalentModuleDetail = lazyWithRetry(() => import("./features/visionkids/pages/talent/ModuleDetail"));
const TalentPortfolio = lazyWithRetry(() => import("./features/visionkids/pages/talent/Portfolio"));
const TalentAchievements = lazyWithRetry(() => import("./features/visionkids/pages/talent/TalentAchievements"));
const CareerExplorer = lazyWithRetry(() => import("./features/visionkids/pages/talent/CareerExplorer"));
const CareerDetail = lazyWithRetry(() => import("./features/visionkids/pages/talent/CareerDetail"));
const TalentMentors = lazyWithRetry(() => import("./features/visionkids/pages/talent/Mentors"));

// VisionKids Phase 10 — Health & Wellness Hub
const HealthHome = lazyWithRetry(() => import("./features/visionkids/pages/wellness/HealthHome"));
const DailyRoutine = lazyWithRetry(() => import("./features/visionkids/pages/wellness/DailyRoutine"));
const HealthyHabits = lazyWithRetry(() => import("./features/visionkids/pages/wellness/HealthyHabits"));
const Nutrition = lazyWithRetry(() => import("./features/visionkids/pages/wellness/Nutrition"));
const ExerciseCenter = lazyWithRetry(() => import("./features/visionkids/pages/wellness/ExerciseCenter"));
const SleepTracker = lazyWithRetry(() => import("./features/visionkids/pages/wellness/SleepTracker"));
const MoodJournal = lazyWithRetry(() => import("./features/visionkids/pages/wellness/MoodJournal"));
const Mindfulness = lazyWithRetry(() => import("./features/visionkids/pages/wellness/Mindfulness"));
const SafetyAcademy = lazyWithRetry(() => import("./features/visionkids/pages/wellness/SafetyAcademy"));
const FirstAidKids = lazyWithRetry(() => import("./features/visionkids/pages/wellness/FirstAidKids"));
const SmartCompanion = lazyWithRetry(() => import("./features/visionkids/pages/wellness/SmartCompanion"));
const HealthyChallenges = lazyWithRetry(() => import("./features/visionkids/pages/wellness/HealthyChallenges"));
const EmergencyGuide = lazyWithRetry(() => import("./features/visionkids/pages/wellness/EmergencyGuide"));
const WellnessRewards = lazyWithRetry(() => import("./features/visionkids/pages/wellness/WellnessRewards"));
const WellnessAccessibility = lazyWithRetry(() => import("./features/visionkids/pages/wellness/WellnessAccessibility"));
const WellnessLessonDetail = lazyWithRetry(() => import("./features/visionkids/pages/wellness/WellnessLessonDetail"));

// VisionKids Phase 11 — STEM & Innovation Center
const StemHome = lazyWithRetry(() => import("./features/visionkids/pages/stem/StemHome"));
const ScienceLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/ScienceLab"));
const PhysicsLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/PhysicsLab"));
const ChemistryLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/ChemistryLab"));
const BiologyLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/BiologyLab"));
const MathLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/MathLab"));
const EngineeringLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/EngineeringLab"));
const ElectronicsLab = lazyWithRetry(() => import("./features/visionkids/pages/stem/ElectronicsLab"));
const SpaceEngineering = lazyWithRetry(() => import("./features/visionkids/pages/stem/SpaceEngineering"));
const RoboticsWorkshop = lazyWithRetry(() => import("./features/visionkids/pages/stem/RoboticsWorkshop"));
const Design3DStudio = lazyWithRetry(() => import("./features/visionkids/pages/stem/Design3DStudio"));
const StemExperimentDetail = lazyWithRetry(() => import("./features/visionkids/pages/stem/ExperimentDetail"));
const InnovationChallenges = lazyWithRetry(() => import("./features/visionkids/pages/stem/InnovationChallenges"));
const InnovationChallengeDetail = lazyWithRetry(() => import("./features/visionkids/pages/stem/InnovationChallengeDetail"));
const InventorGallery = lazyWithRetry(() => import("./features/visionkids/pages/stem/InventorGallery"));
const ResearchCenter = lazyWithRetry(() => import("./features/visionkids/pages/stem/ResearchCenter"));
const ResearchArticlePage = lazyWithRetry(() => import("./features/visionkids/pages/stem/ResearchArticle"));
const StemRewards = lazyWithRetry(() => import("./features/visionkids/pages/stem/StemRewards"));
const StemAccessibility = lazyWithRetry(() => import("./features/visionkids/pages/stem/StemAccessibility"));

// VisionKids Phase 12 — VisionKids World
const WorldHome = lazyWithRetry(() => import("./features/visionkids/pages/world/WorldHome"));
const WorldInteractiveMap = lazyWithRetry(() => import("./features/visionkids/pages/world/InteractiveMap"));
const WorldMyHome = lazyWithRetry(() => import("./features/visionkids/pages/world/MyHome"));
const WorldDreamCity = lazyWithRetry(() => import("./features/visionkids/pages/world/DreamCity"));
const WorldAdventureIslands = lazyWithRetry(() => import("./features/visionkids/pages/world/AdventureIslands"));
const WorldScienceCity = lazyWithRetry(() => import("./features/visionkids/pages/world/ScienceCity"));
const WorldReadingVillage = lazyWithRetry(() => import("./features/visionkids/pages/world/ReadingVillage"));
const WorldArtDistrict = lazyWithRetry(() => import("./features/visionkids/pages/world/ArtDistrict"));
const WorldMusicTown = lazyWithRetry(() => import("./features/visionkids/pages/world/MusicTown"));
const WorldSportsArena = lazyWithRetry(() => import("./features/visionkids/pages/world/SportsArena"));
const WorldSpacePort = lazyWithRetry(() => import("./features/visionkids/pages/world/SpacePort"));
const WorldOceanWorld = lazyWithRetry(() => import("./features/visionkids/pages/world/OceanWorld"));
const WorldNaturePark = lazyWithRetry(() => import("./features/visionkids/pages/world/NaturePark"));
const WorldEventsPlaza = lazyWithRetry(() => import("./features/visionkids/pages/world/EventsPlaza"));
const WorldMarketplace = lazyWithRetry(() => import("./features/visionkids/pages/world/Marketplace"));
const WorldTransportation = lazyWithRetry(() => import("./features/visionkids/pages/world/Transportation"));
const WorldWeatherCenter = lazyWithRetry(() => import("./features/visionkids/pages/world/WeatherCenter"));
const WorldPassport = lazyWithRetry(() => import("./features/visionkids/pages/world/WorldPassport"));
const WorldAccessibility = lazyWithRetry(() => import("./features/visionkids/pages/world/WorldAccessibility"));
const WorldRegionRoute = lazyWithRetry(() => import("./features/visionkids/pages/world/RegionRoute"));

// VisionKids Phase 13 — Creator & Education Marketplace
const MarketHome = lazyWithRetry(() => import("./features/visionkids/pages/market/MarketplaceHome"));
const MarketDiscover = lazyWithRetry(() => import("./features/visionkids/pages/market/Discover"));
const MarketProductDetail = lazyWithRetry(() => import("./features/visionkids/pages/market/ProductDetail"));
const MarketCourses = lazyWithRetry(() => import("./features/visionkids/pages/market/Courses"));
const MarketBooks = lazyWithRetry(() => import("./features/visionkids/pages/market/Books"));
const MarketGames = lazyWithRetry(() => import("./features/visionkids/pages/market/Games"));
const MarketWorksheets = lazyWithRetry(() => import("./features/visionkids/pages/market/Worksheets"));
const MarketTemplates = lazyWithRetry(() => import("./features/visionkids/pages/market/Templates"));
const MarketMusic = lazyWithRetry(() => import("./features/visionkids/pages/market/Music"));
const MarketVideos = lazyWithRetry(() => import("./features/visionkids/pages/market/Videos"));
const MarketModels3D = lazyWithRetry(() => import("./features/visionkids/pages/market/Models3D"));
const MarketAIPrompts = lazyWithRetry(() => import("./features/visionkids/pages/market/AIPrompts"));
const MarketBundles = lazyWithRetry(() => import("./features/visionkids/pages/market/Bundles"));
const MarketOrders = lazyWithRetry(() => import("./features/visionkids/pages/market/Orders"));
const MarketWishlist = lazyWithRetry(() => import("./features/visionkids/pages/market/Wishlist"));
const MarketCreatorDashboard = lazyWithRetry(() => import("./features/visionkids/pages/market/CreatorDashboard"));
const MarketTeacherDashboard = lazyWithRetry(() => import("./features/visionkids/pages/market/TeacherDashboard"));
const MarketPublisherDashboard = lazyWithRetry(() => import("./features/visionkids/pages/market/PublisherDashboard"));
const MarketDeveloperDashboard = lazyWithRetry(() => import("./features/visionkids/pages/market/DeveloperDashboard"));
const MarketCreatorAnalytics = lazyWithRetry(() => import("./features/visionkids/pages/market/CreatorAnalytics"));
const MarketCreatorVerification = lazyWithRetry(() => import("./features/visionkids/pages/market/CreatorVerification"));
const MarketModerationQueue = lazyWithRetry(() => import("./features/visionkids/pages/market/ModerationQueue"));
const MarketAccessibility = lazyWithRetry(() => import("./features/visionkids/pages/market/MarketAccessibility"));

// VisionKids Phase 14 — Platform Core & Plugin System
const PlatformHub = lazyWithRetry(() => import("./features/visionkids/pages/platform/PlatformHub"));
const PlatformMarketplace = lazyWithRetry(() => import("./features/visionkids/pages/platform/PluginMarketplace"));
const PlatformMyPlugins = lazyWithRetry(() => import("./features/visionkids/pages/platform/MyPlugins"));
const PlatformDashboard = lazyWithRetry(() => import("./features/visionkids/pages/platform/WidgetDashboard"));
const PlatformThemes = lazyWithRetry(() => import("./features/visionkids/pages/platform/ThemeGallery"));
const PlatformSettings = lazyWithRetry(() => import("./features/visionkids/pages/platform/PlatformSettings"));
const PlatformNotifications = lazyWithRetry(() => import("./features/visionkids/pages/platform/NotificationCenter"));
const PlatformAnalytics = lazyWithRetry(() => import("./features/visionkids/pages/platform/PlatformAnalytics"));
const PlatformAccessibility = lazyWithRetry(() => import("./features/visionkids/pages/platform/PlatformAccessibility"));

// VisionKids Phase 15 — Enterprise & School Ecosystem
const EnterpriseHome = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/EnterpriseHome"));
const EntSchoolsPortal = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/SchoolsPortal"));
const EntSchoolDashboard = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/SchoolDashboard"));
const EntClassrooms = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/Classrooms"));
const EntStudents = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/Students"));
const EntTeachers = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/Teachers"));
const EntParents = lazyWithRetry(() => import("./features/visionkids/pages/enterprise/Parents"));
const EntAttendance = lazyWithRetry(() => import("./features/visionkids/pages/en…35643 tokens truncated…rategy","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"factory-idle", to:"/games/factory-idle", image:laptoptechImg, title:"Factory Idle", titleAr:"المصنع التلقائي", description:"Manage materials, production lines, quality control, and buyer reputation.", descriptionAr:"أدر المواد وخطوط الإنتاج وضبط الجودة وسمعة المشترين.", categories:["Idle","Business Simulation","Strategy","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"aquarium-keeper", to:"/games/aquarium-keeper", image:memoryImg, title:"Aquarium Keeper", titleAr:"حارس الأكواريوم", description:"Maintain habitat capacity, water quality, supplies, and visitor trust.", descriptionAr:"حافظ على سعة الموائل وجودة المياه والإمدادات وثقة الزوار.", categories:["Simulation","Kids","Educational","Accessible"], difficulty:"Easy", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"garden-planner", to:"/games/garden-planner", image:dreamhomeImg, title:"Garden Planner", titleAr:"مخطط الحديقة", description:"Plan seed supply, garden beds, plant health, and community reputation.", descriptionAr:"خطط للبذور وأحواض الزراعة وصحة النباتات وسمعة المجتمع.", categories:["Simulation","Educational","Strategy","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"museum-curator", to:"/games/museum-curator", image:tradetycoonImg, title:"Museum Curator", titleAr:"أمين المتحف", description:"Acquire exhibits, expand galleries, improve curation, and earn public trust.", descriptionAr:"اقتَنِ المعروضات ووسّع الصالات وحسّن التنسيق واكسب ثقة الجمهور.", categories:["Business Simulation","Educational","Strategy","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"wildlife-rescue", to:"/games/wildlife-rescue", image:jungleImg, title:"Wildlife Rescue", titleAr:"إنقاذ الحياة البرية", description:"Coordinate supplies, rescue teams, treatment quality, and public confidence.", descriptionAr:"نسّق الإمدادات وفرق الإنقاذ وجودة العلاج وثقة المجتمع.", categories:["Simulation","Strategy","Educational","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"solitaire", to:"/games/solitaire", image:card99Img, title:"Solitaire", titleAr:"سوليتير", description:"Build descending alternating-color card sequences and clear the tableau.", descriptionAr:"ابنِ تسلسلات بطاقات تنازلية متعاقبة الألوان وأخلِ الطاولة.", categories:["Card","Classic","Strategy","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"spider-solitaire", to:"/games/spider-solitaire", image:briscolaImg, title:"Spider Solitaire", titleAr:"سبايدر سوليتير", description:"Organize same-suit descending runs under focused Spider rules.", descriptionAr:"نظّم تسلسلات تنازلية من النوع نفسه وفق قواعد سبايدر المركزة.", categories:["Card","Classic","Strategy","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"freecell", to:"/games/freecell", image:farkleImg, title:"FreeCell", titleAr:"فري سيل", description:"Plan exposed-card moves across open columns with FreeCell sequencing.", descriptionAr:"خطط لتحريك البطاقات المكشوفة عبر الأعمدة المفتوحة وفق تسلسل فري سيل.", categories:["Card","Classic","Logic","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"mahjong", to:"/games/mahjong", image:dominoesImg, title:"Mahjong", titleAr:"ماجونغ", description:"Remove matching free-edge tiles from a semantic compact layout.", descriptionAr:"أزل أزواج البلاطات المتطابقة ذات الجانب الحر من تخطيط دلالي مدمج.", categories:["Classic","Puzzle","Board","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"tower-defense", to:"/games/tower-defense", image:tacticalImg, title:"Tower Defense", titleAr:"الدفاع بالأبراج", description:"Place measured-range towers and defend four escalating path waves.", descriptionAr:"ضع أبراجاً بمدى محسوب ودافع عن المسار خلال أربع موجات متصاعدة.", categories:["Tower Defense","Strategy","Arcade","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"maze-runner", to:"/games/maze-runner", image:blindMazeImg, title:"Maze Runner", titleAr:"عداء المتاهة", description:"Navigate a coordinate-labelled maze through walls to the goal.", descriptionAr:"تنقل عبر متاهة معنونة بالإحداثيات متجاوزاً الجدران نحو الهدف.", categories:["Adventure","Puzzle","Logic","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"parking-challenge", to:"/games/parking-challenge", image:velocityImg, title:"Parking Challenge", titleAr:"تحدي ركن السيارة", description:"Route a vehicle around obstacles into a precisely marked parking bay.", descriptionAr:"وجّه المركبة حول العوائق إلى موقف محدد بدقة.", categories:["Simulation","Puzzle","Logic","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"escape-room", to:"/games/escape-room", image:logiquestImg, title:"Escape Room", titleAr:"غرفة الهروب", description:"Solve three maintained word clues to unlock the final exit.", descriptionAr:"حل ثلاثة ألغاز لفظية منظمة لفتح المخرج النهائي.", categories:["Adventure","Puzzle","Word","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"chess", to:"/games/chess", image:chessImg, title:"Chess", titleAr:"شطرنج", description:"Play full-rules chess against a calculating engine across three depths.", descriptionAr:"العب شطرنجاً بقواعده الكاملة ضد محرك يحسب حركاته على ثلاثة مستويات.", categories:["Board","Classic","Strategy","Logic","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, featured:true, recentlyAdded:true, controls:["Keyboard","Touch","Pointer"], accessible:true }),
  game({ slug:"backgammon", to:"/games/backgammon", image:backgammonImg, title:"Backgammon", titleAr:"طاولة الزهر", description:"Bear off all fifteen checkers, using the bar, hits, and exact rolls.", descriptionAr:"أخرج أحجارك الخمسة عشر مستخدماً البار والضرب والرميات المضبوطة.", categories:["Board","Classic","Strategy","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, featured:true, recentlyAdded:true, controls:["Keyboard","Touch","Pointer"], accessible:true }),
  game({ slug:"ludo", to:"/games/ludo", image:ludoImg, title:"Ludo", titleAr:"لودو", description:"Race three rivals around the cross board and bring four tokens home.", descriptionAr:"سابق ثلاثة منافسين حول رقعة الصليب وأوصل أحجارك الأربعة إلى المركز.", categories:["Board","Classic","Strategy","Kids","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch","Pointer"], accessible:true }),
  game({ slug:"word-master", to:"/games/word-master", image:wordMasterImg, title:"Word Master", titleAr:"سيد الكلمات", description:"Guess the five-letter word in six tries, in Arabic or English.", descriptionAr:"خمّن كلمة الخمسة حروف خلال ست محاولات بالعربية أو الإنجليزية.", categories:["Word","Puzzle","Educational","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, trending:true, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"skybound-quest", to:"/games/skybound-quest", image:skyboundImg, title:"Skybound Quest", titleAr:"مغامرة بوابة السماء", description:"Jump between sky platforms for every gem, one unhurried move at a time.", descriptionAr:"اقفز بين منصات السماء لجمع كل جوهرة، بحركة واحدة كاملة في كل مرة.", categories:["Platform","Adventure","Puzzle","Logic","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, trending:true, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"hex", to:"/games/hex", image:logiquestImg, title:"Hex", titleAr:"هيكس", description:"Build an unbroken edge-to-edge path across a compact tactical board.", descriptionAr:"ابنِ مساراً متصلاً من حافة إلى أخرى على لوحة تكتيكية مدمجة.", categories:["Board","Strategy","Logic","Accessible"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"mancala", to:"/games/mancala", image:dominoesImg, title:"Mancala", titleAr:"منقلة", description:"Sow stones, earn extra turns, and capture the opposite pits strategically.", descriptionAr:"وزّع الأحجار واكسب أدواراً إضافية والتقط الحفر المقابلة باستراتيجية.", categories:["Board","Classic","Strategy","Math","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"royal-game-of-ur", to:"/games/royal-game-of-ur", image:visionopolyImg, title:"Royal Game of Ur", titleAr:"لعبة أور الملكية", description:"Guide three pieces through an exact-roll race inspired by the ancient board game.", descriptionAr:"وجّه ثلاث قطع في سباق يعتمد الرمية الدقيقة مستوحى من اللعبة الأثرية القديمة.", categories:["Board","Classic","Strategy","Educational","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:true }),
];

export function getArcadeGame(pathname: string) {
  return ARCADE_GAMES.find((item) => item.to === pathname);
}

export function localizeGame(item: ArcadeGame, lang: string) {
  return lang === "ar"
    ? { title: item.titleAr, description: item.descriptionAr }
    : { title: item.title, description: item.description };
}
