import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { LeaderboardTable } from "@/components/academy/gamification/LeaderboardTable";
import { CelebrationBanner } from "@/components/academy/gamification/CelebrationBanner";
import { useAcademyGamificationTick } from "@/hooks/academy/useGamificationTick";
import { getAcademyLevelInfo } from "@/lib/academy/leveling";
import { getLeaderboardPrivacy, setLeaderboardPrivacy, getMyLeaderboardEntry } from "@/lib/academy/gamificationLocalStore";

export default function AcademyLeaderboard() {
  const { user } = useAuth();
  const { profile, celebration, dismissCelebration } = useAcademyGamificationTick();

  const [privacyVersion, setPrivacyVersion] = useState(0);
  const privacy = useMemo(() => (user ? getLeaderboardPrivacy(user.id) : null), [user, privacyVersion]);

  const xpTotal = profile?.xp_total ?? 0;
  const levelInfo = useMemo(() => getAcademyLevelInfo(xpTotal), [xpTotal]);
  const displayName = profile?.name || user?.email || "طالب الأكاديمية";
  const myEntry = useMemo(
    () => (user ? getMyLeaderboardEntry(user.id, displayName, xpTotal, levelInfo.level) : null),
    [user, displayName, xpTotal, levelInfo.level]
  );

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض لوحة المتصدرين.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/leaderboard">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={Crown}
            title="لوحة المتصدرين"
            description="ترتيبك بين المتعلّمين حسب XP"
            headingId="leaderboard-heading"
          />
        </div>

        <CelebrationBanner
          achievements={celebration?.newAchievements ?? []}
          learningCards={celebration?.newLearningCards ?? []}
          streakMilestone={celebration?.streakMilestone ?? null}
          onDismiss={dismissCelebration}
        />

        {myEntry && privacy && (
          <LeaderboardTable
            myEntry={myEntry}
            privacy={privacy}
            onTogglePrivacy={(visible) => {
              setLeaderboardPrivacy(user.id, visible, privacy.visible_display_name);
              setPrivacyVersion((v) => v + 1);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
