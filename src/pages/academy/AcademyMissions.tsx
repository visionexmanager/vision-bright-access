import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { MissionsBoard } from "@/components/academy/gamification/MissionsBoard";
import { CelebrationBanner } from "@/components/academy/gamification/CelebrationBanner";
import { useAcademyGamificationTick } from "@/hooks/academy/useGamificationTick";
import { getMissionsWithProgress } from "@/lib/academy/gamificationLocalStore";

export default function AcademyMissions() {
  const { user } = useAuth();
  const { celebration, dismissCelebration } = useAcademyGamificationTick();

  const missions = useMemo(() => (user ? getMissionsWithProgress(user.id) : []), [user, celebration]);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض مهامك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/missions">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={Target}
            title="المهام"
            description="مهام يومية وأسبوعية وشهرية تمنحك XP إضافية عند إكمالها"
            headingId="missions-heading"
          />
        </div>

        <CelebrationBanner
          achievements={celebration?.newAchievements ?? []}
          learningCards={celebration?.newLearningCards ?? []}
          streakMilestone={celebration?.streakMilestone ?? null}
          onDismiss={dismissCelebration}
        />

        <MissionsBoard missions={missions} />
      </div>
    </Layout>
  );
}
