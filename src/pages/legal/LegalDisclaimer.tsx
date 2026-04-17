import { Layout } from "@/components/Layout";
import { TriangleAlert } from "lucide-react";

const clauses = [
  {
    title: "General Purpose",
    body: "Visionex provides digital tools, educational simulations, marketplace services, and community features for informational and interactive purposes.",
  },
  {
    title: "Not Professional Advice",
    body: "Content available on Visionex is provided for general informational purposes and should not be considered professional, legal, medical, or financial advice.",
  },
  {
    title: "User-Generated Content",
    body: "Visionex does not guarantee the accuracy or completeness of user-generated content, marketplace listings, or third-party information.",
  },
  {
    title: "User Responsibility",
    body: "Users are responsible for evaluating information and services before relying on them.",
  },
  {
    title: "Limitation of Liability",
    body: "Visionex shall not be held liable for losses or damages resulting from reliance on platform content or interactions with third-party sellers or users.",
  },
];

export default function LegalDisclaimer() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <TriangleAlert className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Legal Disclaimer</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <div className="space-y-4">
          {clauses.map((clause) => (
            <div key={clause.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-2 font-semibold text-foreground">{clause.title}</h2>
              <p className="leading-relaxed text-muted-foreground">{clause.body}</p>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
