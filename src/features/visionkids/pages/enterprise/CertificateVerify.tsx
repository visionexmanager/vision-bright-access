import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, ShieldX, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useVerifyCertificate } from "@/features/visionkids/hooks/enterprise/useEnterprise";

/** PUBLIC certificate verification (QR target). No org membership required —
 *  the verify RPC returns only the printed fields. */
export default function CertificateVerify() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const initial = params.get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [query, setQuery] = useState(initial);
  const { data: result, isLoading } = useVerifyCertificate(query || undefined);

  useEffect(() => { if (initial) setQuery(initial); }, [initial]);

  useDocumentHead({
    title: `${t("kids.enterprise.verify.title")} — VisionKids`,
    description: t("kids.enterprise.verify.subtitle"),
    canonicalPath: "/kids/enterprise/verify",
  });

  function check() {
    setQuery(code.trim());
    setParams(code.trim() ? { code: code.trim() } : {});
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="text-center font-heading text-3xl font-extrabold">
        <span aria-hidden="true">🔎</span> {t("kids.enterprise.verify.title")}
      </h1>
      <p className="mt-2 text-center text-muted-foreground">{t("kids.enterprise.verify.subtitle")}</p>

      <div className="mt-6 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("kids.enterprise.verify.codePlaceholder")}
          className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2" />
        <button type="button" onClick={check} className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90">
          <Search className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.verify.check")}
        </button>
      </div>

      {query && (
        isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
        ) : result?.valid ? (
          <div className="mt-6 rounded-3xl border-2 border-kids-green/40 bg-kids-green/5 p-6 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-kids-green" aria-hidden="true" />
            <p className="mt-2 font-heading text-xl font-bold text-kids-green">{t("kids.enterprise.verify.valid")}</p>
            <dl className="mt-4 space-y-1 text-sm">
              <div><dt className="inline font-semibold">{t("kids.enterprise.verify.student")}: </dt><dd className="inline">{result.student_name}</dd></div>
              <div><dt className="inline font-semibold">{t("kids.enterprise.verify.award")}: </dt><dd className="inline">{result.title}</dd></div>
              <div><dt className="inline font-semibold">{t("kids.enterprise.verify.org")}: </dt><dd className="inline">{result.org_name}</dd></div>
              {result.issued_at && <div><dt className="inline font-semibold">{t("kids.enterprise.verify.date")}: </dt><dd className="inline">{new Date(result.issued_at).toLocaleDateString()}</dd></div>}
            </dl>
            {result.signature && <p className="mt-3 text-xs italic text-muted-foreground">{result.signature}</p>}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border-2 border-kids-pink/40 bg-kids-pink/5 p-6 text-center">
            <ShieldX className="mx-auto h-12 w-12 text-kids-pink" aria-hidden="true" />
            <p className="mt-2 font-heading text-xl font-bold text-kids-pink">{t("kids.enterprise.verify.invalid")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("kids.enterprise.verify.invalidHint")}</p>
          </div>
        )
      )}
    </div>
  );
}
