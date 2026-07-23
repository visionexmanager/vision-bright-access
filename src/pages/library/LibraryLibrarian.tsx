import { Link } from "react-router-dom";
import {
  UserCircle, MessageSquare, Sparkles, ShieldCheck, Microscope, Network,
  Waypoints, Clock, FolderKanban, ArrowRight,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { DailyAssistantPanel } from "@/components/library/librarian/DailyAssistantPanel";
import { SmartAutomationPanel } from "@/components/library/librarian/SmartAutomationPanel";
import { ReadingCoachPanel } from "@/components/library/librarian/ReadingCoachPanel";
import { LibrarianGoalsPanel } from "@/components/library/librarian/LibrarianGoalsPanel";
import { RecommendationsFeed } from "@/components/library/librarian/RecommendationsFeed";
import { LibrarianVoiceButton } from "@/components/library/librarian/LibrarianVoiceButton";
import { useLibrarianDailyPlan } from "@/hooks/library/useLibrarianDailyPlan";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const QUICK_LINKS = [
  { to: "/library/librarian/profile", icon: UserCircle, labelKey: "library.librarian.profile.title" },
  { to: "/library/librarian/chat", icon: MessageSquare, labelKey: "library.librarian.chat.title" },
  { to: "/library/librarian/summaries", icon: Sparkles, labelKey: "library.librarian.summaries.title" },
  { to: "/library/librarian/privacy", icon: ShieldCheck, labelKey: "library.librarian.privacy.title" },
];

const RESEARCH_MODE_LINKS = [
  { to: "/library/research-assistant", icon: Microscope, labelKey: "library.researchAssistant.title" },
  { to: "/library/research-projects", icon: FolderKanban, labelKey: "library.researchProjects.title" },
  { to: "/library/knowledge-graph", icon: Network, labelKey: "library.knowledgeGraph.title" },
  { to: "/library/timelines", icon: Clock, labelKey: "library.timelines.title" },
  { to: "/library/ai-search", icon: Waypoints, labelKey: "library.aiSearch.title" },
];

export default function LibraryLibrarian() {
  const { t } = useLanguage();
  const { plan } = useLibrarianDailyPlan();

  useDocumentHead({ title: t("library.librarian.title") });

  return (
    <Layout>
      <LibraryLayout
        title={t("library.librarian.title")}
        breadcrumb={[{ label: t("library.librarian.title") }]}
        headerActions={<LibrarianVoiceButton motivationalSummary={plan?.motivational_summary} />}
      >
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.to} to={link.to}>
                  <Card className="flex h-full flex-col items-center gap-1.5 p-4 text-center hover:shadow-md">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium">{t(link.labelKey)}</span>
                  </Card>
                </Link>
              );
            })}
          </div>

          <SmartAutomationPanel />
          <DailyAssistantPanel />
          <ReadingCoachPanel />
          <LibrarianGoalsPanel />
          <RecommendationsFeed />

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Microscope className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.researchMode.title")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{t("library.librarian.researchMode.description")}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RESEARCH_MODE_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} to={link.to}>
                    <Card className="flex items-center justify-between gap-2 p-3 hover:shadow-md">
                      <span className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> {t(link.labelKey)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
