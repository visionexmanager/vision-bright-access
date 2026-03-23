import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Games() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("games.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("games.subtitle")}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/games/quiz-challenge" className="group">
            <Card className="h-full transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-3 flex items-center gap-2">
                  <Gamepad2 className="h-8 w-8 text-primary" aria-hidden="true" />
                  <Badge variant="secondary">{t("games.quiz.badge")}</Badge>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {t("games.quiz.title")}
                </CardTitle>
                <CardDescription>{t("games.quiz.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("games.quiz.info")}</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
