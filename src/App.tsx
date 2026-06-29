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
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const ProfessionalTools = lazy(() => import("./pages/ProfessionalTools"));
const ToolDetail = lazy(() => import("./pages/ToolDetail"));

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
const LiveTV          = lazy(() => import("./pages/services/LiveTV"));
const LiveTVWatch     = lazy(() => import("./pages/services/LiveTVWatch"));
const LiveTVSubscribe = lazy(() => import("./pages/services/LiveTVSubscribe"));
const LiveTVFavorites = lazy(() => import("./pages/services/LiveTVFavorites"));
const LiveTVSearch    = lazy(() => import("./pages/services/LiveTVSearch"));
const LiveTVPlaylists = lazy(() => import("./pages/services/LiveTVPlaylists"));
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
                    <Route path="/services/educational-empire" element={<EducationalEmpire />} />
                    <Route path="/services/empathy-oasis" element={<EmpathyOasis />} />
                    <Route path="/services/live-tv"                      element={<LiveTV />} />
                    <Route path="/services/live-tv/subscribe"           element={<LiveTVSubscribe />} />
                    <Route path="/services/live-tv/watch/:channelId"    element={<LiveTVWatch />} />
                    <Route path="/services/live-tv/favorites"           element={<LiveTVFavorites />} />
                    <Route path="/services/live-tv/search"              element={<LiveTVSearch />} />
                    <Route path="/services/live-tv/playlists"           element={<LiveTVPlaylists />} />
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
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/settings" element={<Settings />} />
<Route path="/professional-tools" element={<ProfessionalTools />} />
                    <Route path="/professional-tools/:toolId" element={<ToolDetail />} />
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
                    <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
                    <Route path="/admin/simulations" element={<AdminRoute><AdminSimulations /></AdminRoute>} />
                    <Route path="/admin/news" element={<AdminRoute><AdminNews /></AdminRoute>} />
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
