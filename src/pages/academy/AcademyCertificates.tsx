import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Award, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { CertificateCard } from "@/components/academy/assessment/CertificateCard";
import { getMyCertificates } from "@/lib/academy/certificateLocalStore";

export default function AcademyCertificates() {
  const { user } = useAuth();
  const certificates = useMemo(() => (user ? getMyCertificates(user.id) : []), [user]);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={Award}
            title="شهاداتي"
            description={`${certificates.length} شهادة`}
            headingId="my-certificates-heading"
          />
        </div>

        {certificates.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl space-y-2">
            <Award className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              لا توجد شهادات بعد. أكمل دورة واجتز اختباراتها وواجباتها للحصول على شهادتك الأولى.
            </p>
            <Button asChild variant="outline" className="rounded-xl mt-2">
              <Link to="/academy/courses">تصفح الدورات</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {certificates.map((c) => <CertificateCard key={c.id} certificate={c} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
