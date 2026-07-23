import { Award } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { CertificateCard } from "@/components/library/learning/CertificateCard";
import { useCertificates } from "@/hooks/library/useCertificates";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryCertificates() {
  const { t } = useLanguage();
  const { certificates, isLoading } = useCertificates();

  useDocumentHead({ title: t("library.certificates.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.certificates.title")} breadcrumb={[{ label: t("library.certificates.title") }]}>
        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : certificates.length === 0 ? (
          <EmptyState icon={<Award className="h-8 w-8" />} title={t("library.certificates.empty")} className="py-8" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => <CertificateCard key={cert.id} certificate={cert} />)}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
