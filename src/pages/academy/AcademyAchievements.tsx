import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { LevelProgressCard } from "@/components/academy/gamification/LevelProgressCard";
import { StatisticsPanel } from "@/components/academy/gamification/StatisticsPanel";
import { StreakTracker } from "@/components/academy/gamification/StreakTracker";
import { AchievementGallery } from "@/components/academy/gamification/AchievementGallery";
import { CollectionGrid, type CollectibleItem } from "@/components/academy/gamification/CollectionGrid";
import { CelebrationBanner } from "@/components/academy/gamification/CelebrationBanner";
import { ShareButton } from "@/components/academy/gamification/ShareButton";
import { useAcademyGamificationTick } from "@/hooks/academy/useGamificationTick";
import { getAcademyLevelInfo } from "@/lib/academy/leveling";
import {
  getAchievementCatalog, getUserAchievementIds, computeLearningStatistics, getStreak,
  LEARNING_CARD_CATALOG, getUnlockedLearningCards,
} from "@/lib/academy/gamificationLocalStore";
import { getMyCertificates } from "@/lib/academy/certificateLocalStore";

export default function AcademyAchievements() {
  const { user } = useAuth();
  const { profile, celebration, dismissCelebration } = useAcademyGamificationTick();

  const xpTotal = profile?.xp_total ?? 0;
  const levelInfo = useMemo(() => getAcademyLevelInfo(xpTotal), [xpTotal]);

  const achievements = useMemo(() => getAchievementCatalog(), []);
  const unlockedIds = useMemo(() => (user ? getUserAchievementIds(user.id) : new Set<string>()), [user, celebration]);
  const stats = useMemo(() => (user ? computeLearningStatistics(user.id) : null), [user, celebration]);
  const streak = useMemo(() => (user ? getStreak(user.id) : null), [user, celebration]);
  const unlockedCardIds = useMemo(() => (user ? getUnlockedLearningCards(user.id) : new Set<string>()), [user, celebration]);
  const certificates = useMemo(() => (user ? getMyCertificates(user.id) : []), [user, celebration]);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض إنجازاتك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/achievements">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  const collectionSections = [
    {
      title: "الشارات",
      items: achievements.map((a): CollectibleItem => ({
        id: a.id, title: a.title, icon: a.icon, unlocked: unlockedIds.has(a.id), rarity: a.tier, kind: "tier",
      })),
    },
    {
      title: "بطاقات التعلّم",
      items: LEARNING_CARD_CATALOG.map((c): CollectibleItem => ({
        id: c.id, title: c.title, icon: c.icon, unlocked: unlockedCardIds.has(c.id), rarity: c.rarity, kind: "rarity",
      })),
    },
    {
      title: "الشهادات",
      items: certificates.map((c): CollectibleItem => ({
        id: c.id, title: c.title, icon: "Award", unlocked: true, rarity: "gold", kind: "tier",
      })),
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <AcademySectionHeader
              icon={Trophy}
              title="إنجازاتي"
              description="مستواك، شاراتك، مجموعاتك، وتتابع تعلّمك — كل ما أنجزته في الأكاديمية"
              headingId="achievements-heading"
            />
            <ShareButton title="إنجازاتي في أكاديمية VisionEx" text={`وصلت إلى المستوى ${levelInfo.level} (${levelInfo.rank.rank}) في أكاديمية VisionEx!`} />
          </div>
        </div>

        <CelebrationBanner
          achievements={celebration?.newAchievements ?? []}
          learningCards={celebration?.newLearningCards ?? []}
          streakMilestone={celebration?.streakMilestone ?? null}
          onDismiss={dismissCelebration}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LevelProgressCard levelInfo={levelInfo} xpTotal={xpTotal} />
          {streak && <StreakTracker streak={streak} />}
        </div>

        {stats && (
          <section aria-labelledby="stats-heading" className="space-y-3">
            <h2 id="stats-heading" className="text-lg font-black text-foreground">إحصائياتك</h2>
            <StatisticsPanel stats={stats} />
          </section>
        )}

        <section aria-labelledby="gallery-heading" className="space-y-3">
          <h2 id="gallery-heading" className="text-lg font-black text-foreground">معرض الإنجازات</h2>
          <AchievementGallery achievements={achievements} unlockedIds={unlockedIds} />
        </section>

        <section aria-labelledby="collection-heading" className="space-y-3">
          <h2 id="collection-heading" className="text-lg font-black text-foreground">مجموعتي</h2>
          <CollectionGrid sections={collectionSections} />
        </section>
      </div>
    </Layout>
  );
}
