import { Layout } from "@/components/Layout";
import { Shield, Eye, Lock, Share2, UserCheck, Globe, Bell, Trash2 } from "lucide-react";

const DATA_COLLECTED = [
  {
    heading: "Account Information",
    text: "When you register, we collect your username, email address, password (stored as a secure hash), and optional profile details such as display name and avatar.",
  },
  {
    heading: "VXBazaar Marketplace Data",
    text: "If you open a shop or make purchases, we collect shop names, product listings, pricing, transaction records, and buyer-seller communications. Shop tier selections and VX Coins spent on setup fees are also recorded.",
  },
  {
    heading: "VX Coins & Activity Data",
    text: "We track your VX Coins balance, earning history (games, activities, ad views), and spending history (shop creation, marketplace actions). This data is necessary to operate the rewards system.",
  },
  {
    heading: "AI Feature Usage",
    text: "When you interact with AI-powered features (conversational assistant, nutrition analysis, product enrichment, VXBazaar seller chat), your messages are sent to OpenAI for processing. We do not permanently store AI conversation history beyond what is needed for the session.",
  },
  {
    heading: "Voice Communication",
    text: "Voice chat features are powered by LiveKit and process real-time audio data to enable communication. Voice sessions are not recorded or stored unless explicitly stated for a specific feature.",
  },
  {
    heading: "Community Content",
    text: "Posts, comments, reactions, and other content you publish in the community are stored and visible to other users according to your privacy settings.",
  },
  {
    heading: "Technical & Usage Data",
    text: "We automatically collect IP address, device type, operating system, browser type, pages visited, session duration, click events, and error logs to maintain and improve the platform.",
  },
  {
    heading: "Newsletter Subscriptions",
    text: "If you subscribe to our newsletter, we store your email address solely for the purpose of sending platform updates and announcements. Your email is processed through Resend for delivery. You may unsubscribe at any time.",
  },
  {
    heading: "Professional Tools & Purchases",
    text: "When you purchase Professional Tools using VX Coins, we record the tool ID, VX Coins deducted, purchase timestamp, and your user ID. This data is used to manage access to purchased tools and prevent duplicate charges.",
  },
  {
    heading: "Image Analysis (Radar AI)",
    text: "When you use the Radar AI feature, images you upload or capture via camera are sent to OpenAI's Vision API for analysis. Images are not stored permanently on our servers and are not used to train AI models.",
  },
];

const DATA_USE = [
  "Operate and maintain all platform features including VXBazaar, games, community, and services",
  "Process VX Coins earning and spending, and maintain accurate balances",
  "Power AI features by routing your messages to OpenAI's API",
  "Enable voice communication via LiveKit's real-time infrastructure",
  "Display personalized content and relevant marketplace recommendations",
  "Send newsletters and platform announcements to subscribed users",
  "Detect and prevent fraud, abuse, and violations of our Terms of Use",
  "Analyze platform usage to improve performance and accessibility",
  "Comply with legal obligations when required by applicable law",
];

const THIRD_PARTIES = [
  {
    name: "Supabase",
    purpose: "Database, authentication, and file storage infrastructure",
    link: "https://supabase.com/privacy",
  },
  {
    name: "OpenAI",
    purpose: "AI-powered features including conversational assistant, nutrition analysis, and marketplace chat",
    link: "https://openai.com/policies/privacy-policy",
  },
  {
    name: "Google AdSense",
    purpose: "Display advertising — Google may use cookies to serve personalized ads",
    link: "https://policies.google.com/privacy",
  },
  {
    name: "LiveKit",
    purpose: "Real-time voice communication in community rooms",
    link: "https://livekit.io/privacy",
  },
  {
    name: "Resend",
    purpose: "Transactional and newsletter email delivery — your email address is shared with Resend solely to send platform communications you have requested",
    link: "https://resend.com/legal/privacy-policy",
  },
];

const USER_RIGHTS = [
  { icon: Eye, title: "Access", desc: "Request a copy of the personal data we hold about you." },
  { icon: UserCheck, title: "Correction", desc: "Request correction of inaccurate or incomplete data." },
  { icon: Trash2, title: "Deletion", desc: "Request deletion of your account and associated data, subject to legal retention requirements." },
  { icon: Lock, title: "Restriction", desc: "Request that we restrict certain types of processing of your data." },
  { icon: Share2, title: "Portability", desc: "Request your data in a structured, machine-readable format where applicable." },
  { icon: Bell, title: "Opt-Out", desc: "Unsubscribe from newsletters at any time via the link in any email we send." },
];

export default function PrivacyPolicy() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: April 2026</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          This Privacy Policy explains how Visionex collects, uses, stores, and protects information about you when you use our platform — including VXBazaar, AI-powered services, community features, games, and the VX Coins system. By using Visionex, you agree to the practices described here.
        </p>

        {/* Data Collected */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">1. Information We Collect</h2>
          <div className="space-y-5">
            {DATA_COLLECTED.map((item) => (
              <div key={item.heading}>
                <h3 className="mb-1 font-semibold text-foreground">{item.heading}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How We Use */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">2. How We Use Your Information</h2>
          <ul className="space-y-2.5">
            {DATA_USE.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Cookies */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">3. Cookies & Tracking</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use cookies and similar technologies to remember your preferences (theme, language), maintain your login session, and enable advertising through Google AdSense. Google may use cookies to serve personalized ads based on your browsing activity. You may disable cookies through your browser settings, though some platform features may not function correctly without them. You can opt out of personalized Google ads at <span className="text-primary">g.co/adsettings</span>.
          </p>
        </div>

        {/* Third Parties */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">4. Third-Party Service Providers</h2>
          <p className="mb-4 text-sm text-muted-foreground">Visionex uses the following third-party providers to operate its services. Each provider has their own privacy policy governing their data handling practices:</p>
          <div className="space-y-4">
            {THIRD_PARTIES.map((tp) => (
              <div key={tp.name} className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold text-sm">{tp.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{tp.purpose}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">We do not sell your personal data to any third party.</p>
        </div>

        {/* Data Sharing */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">5. Data Sharing</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We do not sell your personal information. We may share data with: (a) service providers listed above, solely to operate the platform; (b) law enforcement or government authorities when required by applicable law or to protect the rights and safety of users; (c) a successor entity in the event of a merger, acquisition, or sale of assets — you will be notified if this occurs.
          </p>
        </div>

        {/* Data Security */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">6. Data Security</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We implement industry-standard security measures including encrypted HTTPS connections, hashed password storage, row-level security on our database, and regular security reviews. However, no system is completely immune to breaches. In the event of a data incident affecting your data, we will notify you as required by applicable law.
          </p>
        </div>

        {/* Retention */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">7. Data Retention</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We retain your account data for as long as your account is active or as needed to provide services. VXBazaar transaction logs and VX Coins history may be retained for up to 3 years for fraud prevention purposes. Newsletter subscriptions are retained until you unsubscribe. If you delete your account, we will remove your personal data within 30 days, except where legal retention obligations apply.
          </p>
        </div>

        {/* Children */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">8. Children's Privacy</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Visionex is not directed at children under 13. Users aged 13–17 may use the platform with parental or guardian consent. We do not knowingly collect personal data from children under 13. If we become aware of such data, it will be deleted promptly. Parents or guardians may contact us at hello@visionex.app to request data review or deletion.
          </p>
        </div>

        {/* User Rights */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">9. Your Rights</h2>
          <p className="mb-4 text-sm text-muted-foreground">Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {USER_RIGHTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">To exercise any of these rights, contact us at <span className="font-semibold text-primary">hello@visionex.app</span>.</p>
        </div>

        {/* International */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">10. International Users</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Visionex serves a global audience. Your data may be processed in countries where our service providers operate, which may have different data protection laws than your country. By using Visionex, you consent to this cross-border data processing. Users in the EU/EEA have additional rights under the GDPR; users in California have rights under the CCPA. These laws are not overridden by these Terms.
          </p>
        </div>

        {/* Changes */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">11. Changes to This Policy</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update this Privacy Policy to reflect changes to our platform, services, or legal requirements. Material changes will be announced through the platform. The "Last Updated" date at the top of this page indicates when the most recent revision was made. Continued use of Visionex after changes constitutes acceptance.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Privacy inquiries may be directed to{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
