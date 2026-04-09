import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SoundProvider } from "@/contexts/SoundContext";
import { AdminRoute } from "@/components/AdminRoute";
import { PageTracker } from "@/components/PageTracker";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Services = lazy(() => import("./pages/Services"));
const Academy = lazy(() => import("./pages/Academy"));
const Content = lazy(() => import("./pages/Content"));
const Contact = lazy(() => import("./pages/Contact"));
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
const CoinsStore = lazy(() => import("./pages/CoinsStore"));
const News = lazy(() => import("./pages/News"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));

// New service pages
const CareerHub = lazy(() => import("./pages/services/CareerHub"));
const MusicConservatory = lazy(() => import("./pages/services/MusicConservatory"));
const GlobalStudio = lazy(() => import("./pages/services/GlobalStudio"));

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

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminRequests = lazy(() => import("./pages/admin/AdminRequests"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LanguageProvider>
             <AuthProvider>
              <CartProvider>
              <SoundProvider>
                <Suspense fallback={<PageLoader />}>
                  <PageTracker />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/academy" element={<Academy />} />
                    <Route path="/content" element={<Content />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="/games/quiz-challenge" element={<QuizChallenge />} />
                    <Route path="/games/memory" element={<MemoryGame />} />
                    <Route path="/games/word-puzzle" element={<WordPuzzle />} />
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
                    <Route path="/games/hangman" element={<Hangman />} />
                    <Route path="/games/dominoes" element={<Dominoes />} />
                    <Route path="/games/farkle" element={<FarkleGame />} />
                    <Route path="/games/jungle-survival" element={<JungleSurvival />} />
                    <Route path="/games/star-chef" element={<StarChef />} />
                    <Route path="/games/uno-ultra" element={<UnoUltra />} />
                    <Route path="/games/neon-breach" element={<NeonBreach />} />
                    <Route path="/games/logiquest" element={<LogiQuest />} />
                    <Route path="/games/trade-tycoon" element={<TradeTycoon />} />
                    <Route path="/games/tactical-strike" element={<TacticalStrike />} />
                    <Route path="/games/briscola" element={<Briscola />} />
                    <Route path="/games/card-99" element={<Card99 />} />
                    <Route path="/games/dream-home" element={<DreamHome />} />
                    <Route path="/games/laptop-tech" element={<LaptopTechMaster />} />
                    <Route path="/games/music-ear" element={<MusicEarMaster />} />
                    <Route path="/games/fashion-designer" element={<FashionDesigner />} />
                    <Route path="/games/velocity-racing" element={<VelocityXRacing />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/coins-store" element={<CoinsStore />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Admin routes */}
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
                    <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                    <Route path="/admin/requests" element={<AdminRoute><AdminRequests /></AdminRoute>} />
                    <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </SoundProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
