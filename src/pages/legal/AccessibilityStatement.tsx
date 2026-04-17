import { Layout } from "@/components/Layout";
import { Accessibility } from "lucide-react";

const features = [
  "Screen reader compatibility",
  "Keyboard navigation support",
  "Voice interaction tools",
  "Accessible interface design",
];

export default function AccessibilityStatement() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Accessibility className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Accessibility Statement</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="leading-relaxed text-muted-foreground">
              Visionex is committed to providing an inclusive digital experience for users of all abilities.
              The platform is designed to welcome users of all backgrounds and abilities, with continuous
              improvements to accessibility and usability based on recognized accessibility standards.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Accessibility Features</h2>
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Users experiencing accessibility barriers may contact{" "}
            <a href="mailto:support@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              support@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
