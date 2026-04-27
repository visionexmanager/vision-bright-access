import { Layout } from "@/components/Layout";
import { ScrollText } from "lucide-react";

const sections = [
  {
    title: "Platform Description",
    body: "Visionex is a global inclusive digital platform offering educational tools, accessibility resources, interactive games, AI-powered services, a virtual marketplace (VXBazaar), community interaction, voice communication, professional tools, and a virtual currency system (VX Coins). The platform is designed to serve a diverse global audience, with a particular focus on accessibility for users with visual impairments and other disabilities.",
  },
  {
    title: "Eligibility & Account Registration",
    body: "Users must be at least 13 years of age to create an account. Users under 18 must have parental or guardian consent. By registering, you confirm that all information provided is accurate and up to date. You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted through your account. Visionex may suspend or permanently terminate accounts that violate these Terms.",
  },
  {
    title: "Acceptable Use",
    body: "You agree to use Visionex only for lawful purposes and in a manner that does not infringe the rights of others. Prohibited activities include: harassment, hate speech, uploading malicious code or viruses, impersonating other users or staff, scraping or reverse-engineering the platform, creating multiple accounts to abuse the system, and attempting to exploit or manipulate platform features or rewards.",
  },
  {
    title: "User-Generated Content",
    body: "By submitting content (posts, product listings, shop names, images, messages) you grant Visionex a non-exclusive, royalty-free, worldwide license to display and distribute that content on the platform. You remain responsible for the content you submit. Visionex may remove any content that violates these Terms or platform policies without notice.",
  },
  {
    title: "VXBazaar Marketplace",
    body: "VXBazaar allows users to open digital shops and sell products using VX Coins. Shops require an upfront setup cost and a recurring monthly rent paid in VX Coins. Failure to pay monthly rent will result in shop deactivation (not deletion). Sellers are solely responsible for product accuracy, legality, and customer communication. Visionex acts as a technology platform only and is not a party to any buyer-seller transaction. All sales are subject to the VXBazaar Marketplace Policy.",
  },
  {
    title: "VX Coins (Virtual Currency)",
    body: "VX Coins are a platform-only virtual reward currency. They have no real-world monetary value and cannot be exchanged for cash, transferred to other platforms, or refunded. Coins may be earned through platform activities, purchased, or received as rewards. Visionex reserves the right to adjust, reset, or discontinue the VX Coins system at any time. Abuse of the coins system (e.g., farming exploits, fraudulent activities) will result in account suspension.",
  },
  {
    title: "Professional Tools",
    body: "Visionex offers downloadable Professional Tools available for purchase using VX Coins. Each tool has a fixed VX Coin price displayed on its detail page. Purchases are final and non-refundable once the download is initiated. Purchased tools are tied to your account and may be re-downloaded at any time from your account. Visionex reserves the right to update, modify, or discontinue any tool without prior notice; previously purchased tools remain accessible where technically feasible.",
  },
  {
    title: "AI-Powered Features",
    body: "Visionex integrates AI services including conversational assistants, product enrichment tools, nutrition analysis, and marketplace chat. AI responses are generated automatically and may not always be accurate. Do not rely on AI responses for medical, legal, financial, or safety-critical decisions. Visionex is not liable for outcomes resulting from AI-generated content. By using AI features, you agree that your messages may be processed by third-party AI providers (such as OpenAI) under their respective privacy policies.",
  },
  {
    title: "Community & Voice Features",
    body: "Community posts, messages, and voice chat must comply with Community Guidelines. Voice communication data is processed in real-time and is not recorded unless explicitly stated. Users who abuse voice or community features may be muted, restricted, or banned.",
  },
  {
    title: "Accessibility Commitment",
    body: "Visionex is committed to providing an accessible experience for all users. Features such as screen reader support, keyboard navigation, voice interaction, and high-contrast themes are provided to support users with disabilities. If you experience an accessibility barrier, please contact us at hello@visionex.app.",
  },
  {
    title: "Intellectual Property",
    body: "All platform software, design, graphics, branding, and original content are owned by Visionex or its licensed partners. You may not copy, reproduce, distribute, or create derivative works without explicit written permission. Third-party trademarks remain the property of their respective owners.",
  },
  {
    title: "Third-Party Services",
    body: "Visionex integrates third-party services including Supabase (database & authentication), OpenAI (AI features), Google AdSense (advertising), LiveKit (voice communication), and Resend (email delivery). Visionex is not responsible for the practices or policies of these third-party providers. Your use of features powered by third-party services is also subject to their respective terms.",
  },
  {
    title: "Advertising",
    body: "Visionex may display third-party advertisements through Google AdSense and other networks. Advertisement content is not controlled by Visionex. Users may optionally interact with advertisements to earn VX Coins rewards. Such participation is entirely voluntary.",
  },
  {
    title: "Service Availability",
    body: "Visionex strives for high availability but does not guarantee uninterrupted service. The platform may be modified, updated, partially suspended, or fully discontinued at any time, with or without prior notice. Visionex is not liable for any losses resulting from service unavailability.",
  },
  {
    title: "Limitation of Liability",
    body: 'Visionex is provided on an "as-is" and "as-available" basis. To the maximum extent permitted by law, Visionex shall not be liable for indirect, incidental, special, or consequential damages including data loss, loss of revenue, or service interruptions. Total liability shall not exceed the amount paid by the user to Visionex in the preceding 12 months.',
  },
  {
    title: "Account Termination",
    body: "Visionex may suspend or permanently terminate accounts for violations of these Terms, fraudulent activity, abuse of platform systems, or legal requirements. Upon termination, access to the account, VX Coins balance, and VXBazaar shop will be revoked. Users may appeal terminations by contacting hello@visionex.app.",
  },
  {
    title: "Changes to Terms",
    body: "Visionex may update these Terms at any time. Significant changes will be communicated through the platform. Continued use after changes constitutes acceptance of the updated Terms.",
  },
  {
    title: "Governing Law",
    body: "These Terms are governed by applicable digital service regulations. Users in different jurisdictions may have additional rights under local consumer protection and data privacy laws, which these Terms do not override.",
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
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: April 2026</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          These Terms of Use govern your access to and use of the Visionex platform and all its services.
          By accessing or using Visionex, you agree to be bound by these Terms. If you do not agree, please do not use the platform.
        </p>

        <div className="space-y-5">
          {sections.map((section, i) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
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
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
