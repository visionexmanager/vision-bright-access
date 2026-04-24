import { Layout } from "@/components/Layout";
import { Accessibility, Keyboard, MonitorSmartphone, Volume2, Eye, Contrast, Globe, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Eye,
    title: "Screen Reader Support",
    desc: "All pages include semantic HTML, ARIA landmarks, descriptive alt text for images, and aria-label attributes to ensure compatibility with screen readers such as NVDA, JAWS, and VoiceOver.",
  },
  {
    icon: Keyboard,
    title: "Keyboard Navigation",
    desc: "Every interactive element — navigation links, buttons, forms, and modals — is fully reachable and operable using keyboard-only navigation. A visible skip-to-content link is provided at the top of each page.",
  },
  {
    icon: Volume2,
    title: "Voice Interaction",
    desc: "Visionex includes voice input and audio feedback features to support users who rely on voice-based interaction. Marketplace, AI assistant, and community features are designed with voice-first accessibility in mind.",
  },
  {
    icon: Contrast,
    title: "High-Contrast & Dark Mode",
    desc: "Users can toggle between light, dark, and high-contrast themes. Color choices throughout the platform meet or exceed WCAG 2.1 contrast ratio requirements (minimum 4.5:1 for normal text).",
  },
  {
    icon: MonitorSmartphone,
    title: "Responsive Design",
    desc: "The platform is fully responsive and usable on desktop, tablet, and mobile devices. All features are designed to work at various viewport sizes and with zoom levels up to 200%.",
  },
  {
    icon: Globe,
    title: "Multilingual Support",
    desc: "Visionex supports multiple languages including Arabic (with full RTL layout) and English, with additional language options. Language can be switched at any time from the navigation bar.",
  },
  {
    icon: Eye,
    title: "Focus Indicators",
    desc: "Visible focus rings are displayed on all interactive elements to assist users navigating by keyboard or switch access device.",
  },
  {
    icon: Volume2,
    title: "Reduced Motion",
    desc: "Users with vestibular disorders or motion sensitivity can use their system's 'prefers-reduced-motion' setting. Visionex respects this preference and reduces or disables animations accordingly.",
  },
];

const WCAG_PRINCIPLES = [
  { label: "Perceivable", desc: "Information is presented in ways all users can perceive, including via screen readers and adjustable contrast." },
  { label: "Operable", desc: "All functionality is accessible via keyboard. No content requires mouse-only interaction." },
  { label: "Understandable", desc: "Content uses clear language. Forms provide descriptive error messages and labels." },
  { label: "Robust", desc: "Content is built with standard HTML and ARIA to work with current and future assistive technologies." },
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
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: April 2026</p>
          </div>
        </div>

        {/* Commitment */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">Our Commitment</h2>
          <p className="leading-relaxed text-muted-foreground">
            Accessibility is at the core of Visionex's mission. Our platform was designed from the ground up to serve users with visual impairments, hearing differences, motor disabilities, and cognitive differences — alongside all other users. We are committed to meeting and exceeding the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standard.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We believe that digital accessibility is not an optional add-on but a fundamental right. Every feature we build is evaluated for accessibility before release.
          </p>
        </div>

        {/* WCAG Principles */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">WCAG 2.1 Level AA — Four Principles</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {WCAG_PRINCIPLES.map((p) => (
              <div key={p.label} className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold text-sm text-primary">{p.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Accessibility Features</h2>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Known Limitations */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">Known Limitations</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            While we strive for full accessibility, some areas are still being improved:
          </p>
          <ul className="mt-3 space-y-2">
            {[
              "Some complex game interactions may not be fully operable via keyboard alone — we are actively working on keyboard-accessible alternatives.",
              "Third-party advertising content (Google AdSense) is not directly under our control and may not meet all accessibility standards.",
              "Voice room features require a microphone-enabled device and may not be fully accessible for all users — text-based alternatives are available.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Assistive Technology Compatibility */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">Tested Assistive Technologies</h2>
          <p className="text-sm text-muted-foreground mb-3">Visionex is regularly tested with the following tools:</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {["NVDA (Windows)", "VoiceOver (macOS/iOS)", "JAWS (Windows)", "TalkBack (Android)", "Keyboard-only navigation", "Browser zoom 200%"].map((tool) => (
              <div key={tool} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium text-center">
                {tool}
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Feedback & Reporting Barriers</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you encounter an accessibility barrier, or if a page or feature does not work with your assistive technology, please let us know. Your feedback helps us improve the experience for everyone. Contact us at{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">hello@visionex.app</a>{" "}
            with the subject line "Accessibility Feedback." We aim to respond within 5 business days and resolve confirmed accessibility issues within 30 days.
          </p>
        </div>

        {/* Ongoing Commitment */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This statement was last reviewed in <strong>April 2026</strong>. Visionex conducts accessibility audits on every major release. For questions or accessibility support, contact{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
