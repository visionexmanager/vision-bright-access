import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <section className="flex min-h-[60vh] items-center justify-center section-padding">
        <div className="text-center section-narrow">
          <p className="mb-2 text-6xl font-bold text-primary" aria-hidden="true">404</p>
          <h1 className="mb-4 text-3xl font-bold">{t("notFound.title")}</h1>
          <p className="mb-8 text-lg text-muted-foreground">{t("notFound.message")}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/">
              <Button size="lg" className="text-base font-semibold">
                <Home className="me-2 h-5 w-5" /> {t("notFound.link")}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="text-base"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="me-2 h-5 w-5" /> {t("nav.back") || "Go Back"}
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
