import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ShoppingBag, BookOpen, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Index() {
  const { t } = useLanguage();

  const features = [
    {
      icon: ShoppingBag,
      title: t("home.feature.marketplace"),
      desc: t("home.feature.marketplaceDesc"),
      to: "/marketplace",
    },
    {
      icon: Eye,
      title: t("home.feature.services"),
      desc: t("home.feature.servicesDesc"),
      to: "/services",
    },
    {
      icon: BookOpen,
      title: t("home.feature.content"),
      desc: t("home.feature.contentDesc"),
      to: "/content",
    },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="px-4 py-20 text-center" aria-labelledby="hero-heading">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-base font-semibold">{t("home.badge")}</span>
          </div>
          <h1
            id="hero-heading"
            className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          >
            {t("home.title")}
            <span className="text-primary">{t("home.titleHighlight")}</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            {t("home.subtitle")}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6 font-semibold">
                {t("home.getStarted")} <ArrowRight className="ms-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                {t("home.exploreMarketplace")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 px-4 py-16" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="features-heading" className="mb-10 text-center text-3xl font-bold">
            {t("home.featuresTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Link to={f.to} key={f.title} className="group">
                <Card className="h-full transition-shadow hover:shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-ring">
                  <CardContent className="flex flex-col items-start gap-4 p-8">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <f.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-bold">{f.title}</h3>
                    <p className="text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Points CTA */}
      <section className="px-4 py-16 text-center" aria-labelledby="points-heading">
        <div className="mx-auto max-w-2xl">
          <h2 id="points-heading" className="mb-4 text-3xl font-bold">
            {t("home.pointsTitle")}
          </h2>
          <p className="mb-6 text-lg text-muted-foreground">
            {t("home.pointsDesc")}
          </p>
          <Link to="/signup">
            <Button size="lg" className="text-lg px-8 py-6 font-semibold">
              {t("home.claimPoints")}
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
