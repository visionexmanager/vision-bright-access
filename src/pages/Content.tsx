import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

const articles = [
  { title: "Getting Started with Accessibility", category: "Guide", points: 10 },
  { title: "Color Contrast Best Practices", category: "Tutorial", points: 15 },
  { title: "Keyboard Navigation Patterns", category: "Reference", points: 10 },
  { title: "Screen Reader Compatibility", category: "Guide", points: 20 },
  { title: "Inclusive Design Principles", category: "Article", points: 10 },
  { title: "ARIA Labels Done Right", category: "Tutorial", points: 15 },
];

export default function Content() {
  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="content-heading">
        <h1 id="content-heading" className="mb-2 text-3xl font-bold">Content</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Learn about accessibility — earn points for reading and completing content.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Card key={a.title} className="transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold">{a.title}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{a.category}</Badge>
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
