import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Content() {
  const { t } = useLanguage();

  const articles = [
    { title: t("content.a1"), category: "Guide", points: 10 },
    { title: t("content.a2"), category: "Tutorial", points: 15 },
    { title: t("content.a3"), category: "Reference", points: 10 },
    { title: t("content.a4"), category: "Guide", points: 20 },
    { title: t("content.a5"), category: "Article", points: 10 },
    { title: t("content.a6"), category: "Tutorial", points: 15 },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="content-heading">
        <h1 id="content-heading" className="mb-2 text-3xl font-bold">{t("content.title")}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("content.subtitle")}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Card key={a.title} className="transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold">{a.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t(`cat.${a.category}`)}</Badge>
                  <Badge className="text-sm">+{a.points} pts</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
