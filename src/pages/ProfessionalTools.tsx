import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ProfessionalTools() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="section-container py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-6">Professional Tools</h1>
      </section>
    </Layout>
  );
}
