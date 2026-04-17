import { Layout } from "@/components/Layout";
import { Shield } from "lucide-react";

const sections = [
  {
    title: "Information We Collect",
    subsections: [
      {
        heading: "Personal Information",
        text: "Users may provide personal information when creating an account or interacting with services. This may include username, email address, account credentials, and profile information.",
      },
      {
        heading: "Technical and Usage Information",
        text: "Visionex may automatically collect technical information such as IP address, device type, operating system, browser type, session activity, pages visited, and interactions with platform features including simulations, games, and services.",
      },
      {
        heading: "Community Content",
        text: "Users participating in community discussions may create posts, comments, or shared content that becomes visible to other users.",
      },
      {
        heading: "Marketplace Information",
        text: "Users creating stores or purchasing products may generate transaction-related information such as store data, product listings, and order communication.",
      },
      {
        heading: "Voice Communication",
        text: "Voice chat features may process temporary audio communication data to support real-time interaction. Voice conversations are not recorded unless explicitly stated.",
      },
    ],
  },
  {
    title: "How We Use Information",
    body: "Information collected through the platform may be used to operate and maintain Visionex services, provide educational tools and simulations, support community interactions, enable marketplace functionality, improve accessibility features, personalize user experiences, deliver newsletters and updates, analyze platform performance, detect fraud or abuse, and provide customer support. Aggregated or anonymized data may also be used for platform analytics and service improvements.",
  },
  {
    title: "Accessibility and Inclusive Design",
    body: "Visionex is designed as an inclusive digital environment that welcomes users of all backgrounds and abilities. While the platform includes accessibility features supporting individuals with disabilities, it is intended for global public use. Accessibility features may include screen reader compatibility, keyboard navigation support, voice interaction tools, and accessible interface design. Visionex continuously improves accessibility features based on recognized accessibility standards.",
  },
  {
    title: "Cookies and Tracking Technologies",
    body: "Visionex may use cookies and similar technologies to remember user preferences, analyze platform usage, improve service performance, and enable advertising services. Users may disable cookies through browser settings.",
  },
  {
    title: "Advertising",
    body: "Visionex may display advertising through third-party advertising networks. Users may voluntarily watch advertisements to receive optional in-platform rewards such as Visionex Coins. Participation in advertising rewards is optional. Visionex does not control the policies of third-party advertising providers.",
  },
  {
    title: "Visionex Coins System",
    body: "Visionex may provide a virtual reward system referred to as Coins. Coins are digital platform rewards that have no real-world monetary value and cannot be exchanged for cash or transferred outside the platform. Coins may be earned through participation, viewing optional advertisements, completing simulations, or other platform activities. Visionex reserves the right to modify or discontinue the coin system.",
  },
  {
    title: "Marketplace Features",
    body: "Visionex may allow users to create digital stores and list products or services for other users. Visionex operates primarily as a technology platform facilitating connections between buyers and sellers. Transactions may occur between independent users and sellers.",
  },
  {
    title: "Data Sharing",
    body: "Visionex does not sell personal data. Information may be shared with service providers supporting platform operations, analytics services, advertising networks, payment processing providers, or legal authorities when required by applicable law.",
  },
  {
    title: "Data Security",
    body: "Visionex implements reasonable technical and organizational security measures including encrypted communications, infrastructure security monitoring, and access control systems. However, no internet transmission method is completely secure.",
  },
  {
    title: "Children's Privacy",
    body: "Visionex services are not intended for children under the age of 13 without parental supervision. If personal information from a child is identified without proper consent it will be removed.",
  },
  {
    title: "International Users",
    body: "Visionex operates globally and user data may be processed in different jurisdictions depending on infrastructure and service providers.",
  },
  {
    title: "User Rights",
    body: "Depending on applicable laws users may have rights to access personal data, request corrections, request deletion, or restrict certain types of processing. Requests may be submitted through Visionex support channels.",
  },
  {
    title: "Changes to This Policy",
    body: "Visionex may update this Privacy Policy periodically to reflect platform updates or legal requirements.",
  },
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
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          Visionex is a global digital platform offering educational tools, simulations, interactive services,
          community interaction, marketplace features, and accessible digital technologies designed for a diverse
          international audience. This Privacy Policy explains how Visionex collects, uses, stores, and protects
          user information. By using Visionex, you agree to the practices described in this policy.
        </p>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">{section.title}</h2>
              {section.body && (
                <p className="leading-relaxed text-muted-foreground">{section.body}</p>
              )}
              {section.subsections && (
                <div className="space-y-4">
                  {section.subsections.map((sub) => (
                    <div key={sub.heading}>
                      <h3 className="mb-1 font-semibold text-foreground">{sub.heading}</h3>
                      <p className="leading-relaxed text-muted-foreground">{sub.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Privacy inquiries may be directed to{" "}
            <a href="mailto:support@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              support@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
