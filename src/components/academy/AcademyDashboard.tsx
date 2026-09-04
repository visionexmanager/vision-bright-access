import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, Flame, Sparkles as SparklesIcon, LayoutGrid,
  Library, GraduationCap, Landmark, Users, MessagesSquare,
  BadgeCheck, CalendarClock, Newspaper,
  MessageSquare, CalendarDays, TrendingUp, BrainCircuit, FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { speakText } from "@/lib/audio/speech";
import { getXPLevel } from "@/lib/academy/xp";
import { academyModules } from "@/lib/academy/moduleRegistry";
import { useCourseCatalog, useCourseCategories } from "@/hooks/academy/useCourseCatalog";
import { supabase } from "@/integrations/supabase/client";
import { getAllResourcesLocal } from "@/lib/academy/libraryLocalStore";
import { getAllScholarshipsLocal } from "@/lib/academy/scholarshipLocalStore";
import { getAllUniversitiesLocal } from "@/lib/academy/universityLocalStore";
import { getMyCertificates } from "@/lib/academy/certificateLocalStore";
import { useAcademyChat } from "@/hooks/academy/useAcademyChat";
import { usePoints } from "@/hooks/usePoints";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeAcademyProfileValue } from "@/lib/academy/onboardingOptions";
import { AcademyHero } from "./sections/AcademyHero";
import { CareerCompassSection } from "./sections/CareerCompassSection";
import { ContinueLearningSection } from "./sections/ContinueLearningSection";
import { StudentServicesSection } from "./sections/StudentServicesSection";
import { PersonalProgressSection } from "./sections/PersonalProgressSection";
import { AchievementsSection } from "./sections/AchievementsSection";
import { DailyLearningGoalSection } from "./sections/DailyLearningGoalSection";
import { RecentActivitySection } from "./sections/RecentActivitySection";
import { AcademyQuickAccessSection } from "./sections/AcademyQuickAccessSection";
import { AcademyPlaceholderSection } from "./ui/AcademyPlaceholderSection";
import { AcademySectionHeader } from "./ui/AcademySectionHeader";
import { CourseCard } from "./lms/CourseCard";
import { InstructorMiniCard } from "./lms/InstructorMiniCard";
import type { AcademyProfileRow } from "@/lib/types";
import type { AcademyCourseRow, AcademyInstructorRow } from "@/lib/types/academy-modules";

const CATEGORY_ENGLISH: Record<string, string> = {
  "برمجة": "Programming",
  "تطوير تطبيقات": "App Development",
  "أمن سيبراني": "Cybersecurity",
  "علم البيانات": "Data Science",
};

interface CourseListSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  headingId: string;
  courses: AcademyCourseRow[];
  viewAllLabel: string;
}

interface LiveModuleSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  headingId: string;
  href: string;
  ctaLabel: string;
  itemCount: number;
  emptyHint: string;
  availableLabel: string;
}

/** For modules with real routes/data-layer but no hardcoded catalog content
 * (Phase 5: Library/Scholarships/Universities) — honestly reflects whatever
 * count is actually in the local store instead of a generic "coming soon". */
function LiveModuleSection({ icon: Icon, title, description, headingId, href, ctaLabel, itemCount, emptyHint, availableLabel }: LiveModuleSectionProps) {
  return (
    <section aria-labelledby={headingId} className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={Icon}
        title={title}
        description={description}
        headingId={headingId}
        action={
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <Link to={href}>{ctaLabel}</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        {itemCount > 0 ? `${itemCount.toLocaleString()} ${availableLabel}` : emptyHint}
      </p>
    </section>
  );
}

function CourseListSection({ icon, title, description, headingId, courses, viewAllLabel }: CourseListSectionProps) {
  return (
    <section aria-labelledby={headingId} className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={icon}
        title={title}
        description={description}
        headingId={headingId}
        action={
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <Link to="/academy/courses">{viewAllLabel}</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => <CourseCard key={course.id} course={course} />)}
      </div>
    </section>
  );
}

const AILearningCenterSection = lazy(() =>
  import("./sections/AILearningCenterSection").then((m) => ({ default: m.AILearningCenterSection }))
);

function aiLearningSkeletonFallback() {
  return (
    <div className="bg-foreground/5 rounded-3xl border border-border p-6 space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

function getModuleText(id: string, lang: string) {
  const mod = academyModules.find((m) => m.id === id);
  return {
    title: lang === "ar" ? (mod?.labelAr ?? id) : (mod?.labelEn ?? id),
    description: mod?.description,
  };
}

interface AcademyDashboardProps {
  profile: AcademyProfileRow;
}

export function AcademyDashboard({ profile }: AcademyDashboardProps) {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();

  const speak = useCallback((text: string) => speakText(text, lang, { rate: 0.9 }), [lang]);
  const formatTime = useCallback((ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  }, [lang]);

  const displayProfile = useMemo(() => ({
    name: profile.name,
    gender: profile.gender as "male" | "female",
    country: localizeAcademyProfileValue(profile.country, t),
    level: localizeAcademyProfileValue(profile.level, t),
  }), [profile.name, profile.gender, profile.country, profile.level, t]);

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const {
    messages, isStreaming, isLoadingHistory,
    error: chatError, rateLimitCooldown,
    send: sendMessage, clearChat, abortStream,
  } = useAcademyChat(displayProfile, sessionId, lang);

  const { totalPoints } = usePoints();
  const xpFromAcademy = profile.xp_total ?? 0;
  const xpLevel = getXPLevel(xpFromAcademy);

  const [voiceMode, setVoiceMode] = useState(false);
  const [showAptitude, setShowAptitude] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const [chatInput, setChatInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const scrollToId = useCallback((id: string, focusInput = false) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusInput) {
      window.setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, []);

  // React Router doesn't auto-scroll to #hash targets on navigation — deep
  // links like /academy#student-services-heading (from Global Search) need this.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) scrollToId(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Ask Munir about X" deep link — e.g. from a Digital Library resource page.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const ask = searchParams.get("ask");
    if (!ask) return;
    setChatInput(ask);
    scrollToId("ai-learning-center", true);
    const next = new URLSearchParams(searchParams);
    next.delete("ask");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text);
    setChatInput("");
    inputRef.current?.focus();
  }, [isStreaming, sendMessage]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleFeedback = useCallback((id: string, vote: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [id]: prev[id] === vote ? undefined as unknown as "up" : vote }));
  }, []);

  const academyText = useCallback((key: string, variables: Record<string, string> = {}) =>
    Object.entries(variables).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      t(key),
    ), [t]);

  const quickPrompts = useMemo(() => {
    const variables = { level: displayProfile.level, country: displayProfile.country };
    return [
      { icon: <MessageSquare className="w-3.5 h-3.5" />, label: t("academy.prompt.explain"), text: academyText("academy.prompt.explainText", variables) },
      { icon: <CalendarDays className="w-3.5 h-3.5" />, label: t("academy.prompt.studyPlan"), text: academyText("academy.prompt.studyPlanText", variables) },
      { icon: <TrendingUp className="w-3.5 h-3.5" />, label: t("academy.prompt.jobMarket"), text: academyText("academy.prompt.jobMarketText", variables) },
      { icon: <BrainCircuit className="w-3.5 h-3.5" />, label: t("academy.prompt.careerAdvice"), text: t("academy.prompt.careerAdviceText") },
      { icon: <FlaskConical className="w-3.5 h-3.5" />, label: t("academy.prompt.studyTechniques"), text: t("academy.prompt.studyTechniquesText") },
    ];
  }, [academyText, displayProfile.country, displayProfile.level, t]);

  const { courses: recommendedCoursesAll } = useCourseCatalog({ sort: "featured" });
  const { courses: popularCoursesAll } = useCourseCatalog({ sort: "popular" });
  const { courses: newCoursesAll } = useCourseCatalog({ sort: "new" });
  const recommendedCourses = useMemo(() => recommendedCoursesAll.slice(0, 3), [recommendedCoursesAll]);
  const popularCourses = useMemo(() => popularCoursesAll.slice(0, 3), [popularCoursesAll]);
  const newCourses = useMemo(() => newCoursesAll.slice(0, 3), [newCoursesAll]);
  const { categories } = useCourseCategories();
  const { data: featuredInstructors = [] } = useQuery<AcademyInstructorRow[]>({
    queryKey: ["academy", "instructors", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academy_instructors")
        .select("*")
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(3);
      if (error) throw new Error(error.message);
      return (data ?? []) as AcademyInstructorRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const libraryResourceCount = useMemo(() => getAllResourcesLocal().length, []);
  const scholarshipCount = useMemo(() => getAllScholarshipsLocal().length, []);
  const universityCount = useMemo(() => getAllUniversitiesLocal().length, []);
  const certificateCount = useMemo(() => getMyCertificates(profile.user_id).length, [profile.user_id]);

  const lastActiveLabel = useMemo(() => {
    if (!profile.last_active) return null;
    return new Date(profile.last_active).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
  }, [profile.last_active, lang]);

  const inertBackground = fullscreen ? { "aria-hidden": true as const } : {};

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-1000">

      <div {...inertBackground} className="space-y-10">
        <AcademyHero
          displayProfile={displayProfile}
          totalPoints={totalPoints}
          onContinueLearning={() => scrollToId("continue-learning-heading")}
          onOpenAILearning={() => scrollToId("ai-learning-center", true)}
        />

        <AcademyQuickAccessSection />

        <CareerCompassSection
          displayProfile={displayProfile}
          showAptitude={showAptitude}
          onOpenAptitude={() => setShowAptitude(true)}
          onCloseAptitude={() => setShowAptitude(false)}
          onAskJobMarket={() => handleSend(academyText("academy.prompt.jobMarketText", { country: displayProfile.country }))}
        />

        <ContinueLearningSection
          hasChatActivity={messages.length > 0}
          messageCount={messages.filter((m) => m.role === "user").length}
          onOpenAILearning={() => scrollToId("ai-learning-center", true)}
        />

        <CourseListSection
          icon={SparklesIcon}
          title={t("academy.ui.recommendedTitle")}
          description={t("academy.ui.recommendedDesc")}
          viewAllLabel={t("academy.ui.viewAll")}
          headingId="recommended-courses-heading"
          courses={recommendedCourses}
        />

        <CourseListSection
          icon={Flame}
          title={t("academy.ui.popularTitle")}
          description={t("academy.ui.popularDesc")}
          viewAllLabel={t("academy.ui.viewAll")}
          headingId="popular-courses-heading"
          courses={popularCourses}
        />

        <CourseListSection
          icon={BookOpen}
          title={t("academy.ui.newCoursesTitle")}
          description={t("academy.ui.newCoursesDesc")}
          viewAllLabel={t("academy.ui.viewAll")}
          headingId="new-courses-heading"
          courses={newCourses}
        />

        <section aria-labelledby="learning-categories-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
          <AcademySectionHeader
            icon={LayoutGrid}
            title={t("academy.ui.categoriesTitle")}
            description={t("academy.ui.categoriesDesc")}
            headingId="learning-categories-heading"
            action={
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <Link to="/academy/paths">{t("academy.ui.pathsTitle")}</Link>
              </Button>
            }
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category}
                to={`/academy/courses?category=${encodeURIComponent(category)}`}
                className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {lang === "ar" ? category : (CATEGORY_ENGLISH[category] ?? category)}
              </Link>
            ))}
          </div>
        </section>

        <StudentServicesSection
          voiceMode={voiceMode}
          isStreaming={isStreaming}
          onSpeakGreeting={() => speak(t("academy.ui.munirWelcome").replace("{name}", displayProfile.name))}
          onToggleVoiceMode={() => setVoiceMode((v) => !v)}
          onGoToStudyRoom={() => navigate("/content")}
          onGoToOCRScan={() => navigate("/services/ocr-scan")}
          onStudyPlan={() => handleSend(academyText("academy.prompt.studyPlanText", displayProfile))}
          onAcademicGuidance={() => {
            setChatInput(t("academy.ui.munirPrompt"));
            scrollToId("ai-learning-center", true);
          }}
          onTutoring={() => navigate("/academy/courses")}
          onTechnicalSupport={() => navigate("/help")}
        />
      </div>

      <Suspense fallback={aiLearningSkeletonFallback()}>
        <AILearningCenterSection
          displayProfile={displayProfile}
          messages={messages}
          isStreaming={isStreaming}
          isLoadingHistory={isLoadingHistory}
          chatError={chatError}
          rateLimitCooldown={rateLimitCooldown}
          fullscreen={fullscreen}
          voiceMode={voiceMode}
          chatInput={chatInput}
          setChatInput={setChatInput}
          copiedId={copiedId}
          feedback={feedback}
          quickPrompts={quickPrompts}
          scrollRef={scrollRef}
          inputRef={inputRef}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onClearChat={clearChat}
          onAbortStream={abortStream}
          onSend={handleSend}
          onSpeak={speak}
          onCopy={handleCopy}
          onFeedback={handleFeedback}
          formatTime={formatTime}
        />
      </Suspense>

      <div {...inertBackground} className="space-y-10">
        <LiveModuleSection
          icon={Library}
          title={t("academy.ui.libraryTitle")}
          description={getModuleText("library", lang).description}
          headingId="digital-library-heading"
          href="/academy/library"
          ctaLabel={t("academy.ui.libraryCta")}
          itemCount={libraryResourceCount}
          emptyHint={t("academy.ui.libraryEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />
        <LiveModuleSection
          icon={GraduationCap}
          title={getModuleText("scholarships", lang).title}
          description={getModuleText("scholarships", lang).description}
          headingId="scholarships-heading"
          href="/academy/scholarships"
          ctaLabel={t("academy.ui.scholarshipsCta")}
          itemCount={scholarshipCount}
          emptyHint={t("academy.ui.scholarshipsEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />
        <LiveModuleSection
          icon={Landmark}
          title={getModuleText("universities", lang).title}
          description={getModuleText("universities", lang).description}
          headingId="universities-heading"
          href="/academy/universities"
          ctaLabel={t("academy.ui.universitiesCta")}
          itemCount={universityCount}
          emptyHint={t("academy.ui.universitiesEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />
        <section aria-labelledby="featured-instructors-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
          <AcademySectionHeader
            icon={Users}
            title={t("academy.ui.instructorsTitle")}
            description={getModuleText("instructors", lang).description}
            headingId="featured-instructors-heading"
            action={
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <Link to="/academy/instructor/apply">{t("academy.ui.instructorsCta")}</Link>
              </Button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredInstructors.map((instructor) => (
              <Link key={instructor.id} to={`/academy/instructors/${instructor.id}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                <InstructorMiniCard instructor={instructor} />
              </Link>
            ))}
          </div>
        </section>
        <AcademyPlaceholderSection
          title={t("academy.ui.communityTitle")}
          description={getModuleText("community", lang).description}
          icon={MessagesSquare}
          headingId="learning-community-heading"
          linkHref="/community"
          linkLabel={t("academy.ui.communityCta")}
        />
        <LiveModuleSection
          icon={BadgeCheck}
          title={getModuleText("certificates", lang).title}
          description={getModuleText("certificates", lang).description}
          headingId="certificates-heading"
          href="/academy/certificates"
          ctaLabel={t("academy.ui.certificatesCta")}
          itemCount={certificateCount}
          emptyHint={t("academy.ui.certificatesEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />

        <PersonalProgressSection
          displayName={displayProfile.name}
          xpLevel={xpLevel}
          xpFromAcademy={xpFromAcademy}
          totalPoints={totalPoints}
          userMessageCount={messages.filter((m) => m.role === "user").length}
        />

        <AchievementsSection xpFromAcademy={xpFromAcademy} userId={profile.user_id} />

        <DailyLearningGoalSection />

        <LiveModuleSection
          icon={CalendarClock}
          title={t("academy.ui.scheduleTitle")}
          description={t("academy.ui.scheduleDesc")}
          headingId="upcoming-schedule-heading"
          href="/academy/planner"
          ctaLabel={t("academy.ui.plannerCta")}
          itemCount={0}
          emptyHint={t("academy.ui.scheduleEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />

        <RecentActivitySection
          lastActiveLabel={lastActiveLabel}
          messageCount={messages.filter((m) => m.role === "user").length}
        />

        <LiveModuleSection
          icon={Newspaper}
          title={t("academy.ui.newsTitle")}
          description={t("academy.ui.newsDesc")}
          headingId="academy-news-heading"
          href="/academy/notifications"
          ctaLabel={t("academy.ui.notificationsCta")}
          itemCount={0}
          emptyHint={t("academy.ui.newsEmpty")}
          availableLabel={t("academy.ui.availableNow")}
        />
      </div>
    </div>
  );
}
