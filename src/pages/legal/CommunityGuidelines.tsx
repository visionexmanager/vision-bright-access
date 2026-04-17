import { Layout } from "@/components/Layout";
import { Users } from "lucide-react";

const rules = [
  {
    title: "Respectful Communication",
    desc: "Users must communicate respectfully and avoid harassment, hate speech, threats, or abusive behavior.",
  },
  {
    title: "Prohibited Content",
    desc: "Content containing illegal material, harmful content, malicious software, or spam is prohibited.",
  },
  {
    title: "Platform Integrity",
    desc: "Users must not attempt to manipulate platform systems, exploit rewards, or disrupt services.",
  },
  {
    title: "Moderation",
    desc: "Visionex may remove content, restrict accounts, or apply moderation measures when guidelines are violated.",
  },
];

export default function CommunityGuidelines() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Community Guidelines</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          Visionex promotes a respectful and inclusive environment for all users worldwide.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-2 font-semibold text-foreground">{rule.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{rule.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
