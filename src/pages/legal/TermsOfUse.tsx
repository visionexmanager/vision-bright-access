import { Layout } from "@/components/Layout";
import { ScrollText } from "lucide-react";

const sections = [
  {
    title: "Platform Description",
    body: "Visionex provides digital services including educational simulations, accessibility tools, interactive games, marketplace services, community interaction, voice communication features, and other digital resources. The platform is available to a global audience.",
  },
  {
    title: "User Accounts",
    body: "Users may create accounts to access certain features. Users are responsible for maintaining the confidentiality of account credentials and for all activities conducted through their account. Visionex may suspend or terminate accounts that violate platform policies.",
  },
  {
    title: "Community Conduct",
    body: "Users must not engage in harassment, distribute illegal content, violate intellectual property rights, manipulate platform systems, or disrupt services. Visionex reserves the right to remove content or restrict accounts when necessary.",
  },
  {
    title: "Marketplace and Seller Services",
    body: "Visionex may allow users to create stores and offer products or services. Sellers are responsible for product descriptions, pricing, product safety, legal compliance, delivery, and customer service. Visionex acts primarily as a platform provider connecting buyers and sellers.",
  },
  {
    title: "Product Responsibility",
    body: "Products listed on Visionex may be offered by independent sellers. Visionex does not guarantee product quality, safety, or delivery timelines. Disputes between buyers and sellers must be resolved between the involved parties.",
  },
  {
    title: "Virtual Currency",
    body: "Visionex Coins are digital platform rewards that have no real monetary value and cannot be exchanged for real currency. Visionex may adjust or discontinue the coin system.",
  },
  {
    title: "Voice Communication",
    body: "Voice chat services must be used responsibly. Harassment or disruptive behavior may result in suspension.",
  },
  {
    title: "Intellectual Property",
    body: "All software, design, graphics, and platform content are owned by Visionex or licensed partners and may not be copied or distributed without permission.",
  },
  {
    title: "Third-Party Services",
    body: "Visionex may integrate third-party services including hosting infrastructure, analytics providers, communication systems, and advertising networks. Visionex is not responsible for third-party service policies.",
  },
  {
    title: "Service Availability",
    body: "Visionex may modify, suspend, or discontinue services without prior notice.",
  },
  {
    title: "Limitation of Liability",
    body: 'Visionex is provided on an "as-is" basis and shall not be liable for indirect damages, data loss, or service interruptions.',
  },
  {
    title: "Termination",
    body: "Visionex may suspend or terminate accounts that violate these Terms.",
  },
  {
    title: "Governing Law",
    body: "Applicable digital service regulations may apply depending on the user's jurisdiction.",
  },
];

export default function TermsOfUse() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ScrollText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Terms of Use</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          These Terms of Use govern access to and use of the Visionex platform. By accessing or using
          the platform you agree to these terms.
        </p>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              </div>
              <p className="leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Legal inquiries may be directed to{" "}
            <a href="mailto:legal@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              legal@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
