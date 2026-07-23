import { useNavigate } from "react-router-dom";
import { Network } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { KgEntitySearchBox } from "@/components/library/knowledgeGraph/KgEntitySearchBox";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryKnowledgeGraph() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  useDocumentHead({ title: t("library.knowledgeGraph.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.knowledgeGraph.title")}>
        <div className="space-y-6">
          <p className="max-w-2xl text-muted-foreground">{t("library.knowledgeGraph.intro")}</p>
          <KgEntitySearchBox onSelect={(slug) => navigate(`/library/knowledge-graph/${slug}`)} />
          <EmptyState icon={<Network className="h-10 w-10" />} title={t("library.knowledgeGraph.searchPrompt")} description={t("library.knowledgeGraph.searchHint")} />
        </div>
      </LibraryLayout>
    </Layout>
  );
}
