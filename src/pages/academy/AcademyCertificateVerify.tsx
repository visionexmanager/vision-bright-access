import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldX, Search, ArrowLeft } from "lucide-react";
import { CertificateDisplay } from "@/components/academy/assessment/CertificateDisplay";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { verifyCertificateLocal } from "@/lib/academy/certificateLocalStore";
import type { AcademyCertificateRow } from "@/lib/types/academy-modules";

/**
 * Public certificate verification page — intentionally NOT behind AuthGuard,
 * per the Phase 6 brief ("Public verification page"). Anyone with a
 * certificate number (or a QR/link pointing here) can confirm it's real.
 */
export default function AcademyCertificateVerify() {
  const { certificateNumber: routeCertNumber } = useParams<{ certificateNumber?: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState(routeCertNumber ?? "");
  const [certificate, setCertificate] = useState<AcademyCertificateRow | null | undefined>(undefined);
  const [checkedNumber, setCheckedNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!routeCertNumber) {
      setCertificate(undefined);
      return;
    }
    const { certificate: found } = verifyCertificateLocal(routeCertNumber);
    setCertificate(found);
    setCheckedNumber(routeCertNumber);
  }, [routeCertNumber]);

  const handleLookup = () => {
    if (!inputValue.trim()) return;
    navigate(`/academy/verify/${inputValue.trim()}`);
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy"><ArrowLeft className="w-4 h-4" aria-hidden="true" />العودة إلى الأكاديمية</Link>
          </Button>
          <AcademySectionHeader
            icon={ShieldCheck}
            title="التحقق من شهادة"
            description="تأكّد من صحة أي شهادة صادرة عن أكاديمية Visionex"
            headingId="verify-heading"
          />
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col sm:flex-row gap-3" role="search" aria-label="البحث عن شهادة">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="cert-number-input" className="sr-only">رقم الشهادة</label>
            <Input
              id="cert-number-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="أدخل رقم الشهادة (مثال: VX-2026-A3F9K2)"
              className="ps-11 rounded-xl"
              dir="ltr"
            />
          </div>
          <Button onClick={handleLookup} disabled={!inputValue.trim()} className="rounded-xl">تحقق</Button>
        </div>

        {checkedNumber && certificate === null && (
          <div className="text-center py-12 border-2 border-dashed border-destructive/40 rounded-3xl space-y-3">
            <ShieldX className="w-10 h-10 mx-auto text-destructive" aria-hidden="true" />
            <p className="text-destructive font-bold">لم يتم العثور على شهادة بهذا الرقم.</p>
            <p className="text-sm text-muted-foreground">تأكّد من صحة الرقم وحاول مرة أخرى.</p>
          </div>
        )}

        {certificate && <CertificateDisplay certificate={certificate} />}
      </div>
    </Layout>
  );
}
