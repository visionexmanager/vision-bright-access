import { Layout } from "@/components/Layout";
import { Users, Heart, ShieldAlert, Mic, ShoppingBag, Coins, Gavel, CheckCircle2 } from "lucide-react";

const PRINCIPLES = [
  {
    icon: Heart,
    title: "Respect & Inclusion",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    rules: [
      "Treat every user with dignity regardless of their disability, nationality, language, religion, gender, or background.",
      "Visionex serves users with visual impairments and other disabilities — go out of your way to be considerate and supportive.",
      "Constructive criticism is welcome; personal attacks are not. Disagree with ideas, not people.",
      "Use inclusive language. Avoid slurs, derogatory terms, and language that demeans any group.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Prohibited Behavior",
    color: "text-destructive",
    bg: "bg-destructive/10",
    rules: [
      "Harassment, intimidation, stalking, doxxing, or threatening any user — including via private messages.",
      "Hate speech: content promoting hatred or violence based on race, ethnicity, religion, gender, disability, sexual orientation, or national origin.",
      "Impersonating Visionex staff, moderators, or other users.",
      "Spreading misinformation intentionally or sharing content designed to deceive.",
      "Posting illegal content including copyright-infringing material, child exploitation material, or content that violates applicable law.",
      "Spamming: sending unsolicited bulk messages, repetitive posts, or content designed to flood the feed.",
    ],
  },
  {
    icon: Mic,
    title: "Voice Chat & Community Rooms",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    rules: [
      "Voice rooms are public or semi-public spaces. Communicate as you would in a professional environment.",
      "Do not play loud music, sound effects, or disruptive noise in shared rooms.",
      "Recording voice sessions without the knowledge and consent of all participants is prohibited.",
      "Room hosts have the authority to mute or remove disruptive participants.",
      "Do not share private personal information (phone numbers, addresses, passwords) in voice rooms.",
    ],
  },
  {
    icon: ShoppingBag,
    title: "VXBazaar Marketplace Conduct",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    rules: [
      "All shop names, product descriptions, and images must be accurate, truthful, and free of offensive content.",
      "Do not use the marketplace to promote prohibited items (see Marketplace Policy for the full list).",
      "Buyer-seller communication must remain professional. Harassment of buyers or sellers will result in shop suspension.",
      "Do not post fake reviews, engage in review manipulation, or attempt to sabotage other sellers.",
      "Price gouging, bait-and-switch tactics, or misleading promotions are prohibited.",
    ],
  },
  {
    icon: Coins,
    title: "VX Coins & Rewards Integrity",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    rules: [
      "Do not exploit bugs, glitches, or loopholes to earn VX Coins unfairly.",
      "Creating multiple accounts to farm rewards is prohibited and will result in a permanent ban.",
      "Do not attempt to sell, trade, or transfer VX Coins outside of official platform mechanisms.",
      "Reporting a fake bug to manipulate the rewards system is a violation.",
    ],
  },
  {
    icon: CheckCircle2,
    title: "Content Standards",
    color: "text-green-500",
    bg: "bg-green-500/10",
    rules: [
      "All content (posts, images, files, links) must comply with applicable laws.",
      "Do not share malware, viruses, phishing links, or any harmful code.",
      "Adult content, graphic violence, or content sexualizing minors is strictly prohibited and will be reported to authorities.",
      "Respect copyright: do not post content you do not have the rights to share.",
      "Content flagged as misinformation by our moderation team will be removed without notice.",
    ],
  },
];

const ENFORCEMENT = [
  { level: "Warning", desc: "First-time minor violations may receive a formal warning.", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400" },
  { level: "Temporary Restriction", desc: "Repeated or moderate violations may result in posting restrictions or feature lockouts.", color: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400" },
  { level: "Account Suspension", desc: "Serious violations result in temporary or permanent account suspension.", color: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400" },
  { level: "Permanent Ban", desc: "Severe violations (hate speech, harassment campaigns, illegal content) result in a permanent, non-appealable ban.", color: "border-destructive/30 bg-destructive/5 text-destructive" },
  { level: "Legal Referral", desc: "Illegal activity including child exploitation content, credible threats, or fraud will be reported to relevant authorities.", color: "border-primary/30 bg-primary/5 text-primary" },
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
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: April 2026</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="leading-relaxed text-muted-foreground">
            Visionex is a global, inclusive platform with a special commitment to users with visual impairments and other disabilities. Our community is built on respect, safety, and belonging. These guidelines apply to all interactions on Visionex — posts, comments, voice rooms, VXBazaar shops, private messages, and any other form of communication on the platform.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            By using Visionex, you agree to follow these guidelines. Violations may result in content removal, account restrictions, or permanent bans.
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {PRINCIPLES.map(({ icon: Icon, title, color, bg, rules }) => (
            <div key={title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h2 className="text-lg font-bold">{title}</h2>
              </div>
              <ul className="space-y-2.5">
                {rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${color.replace("text-", "bg-")}`} />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Reporting */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Reporting Violations</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you witness a violation of these guidelines, please use the in-platform report button on the content or contact us directly at <span className="font-semibold text-primary">hello@visionex.app</span>. All reports are reviewed by our moderation team. False or malicious reports are themselves a violation.
          </p>
        </div>

        {/* Enforcement */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Enforcement</h2>
          </div>
          <div className="space-y-3">
            {ENFORCEMENT.map((e) => (
              <div key={e.level} className={`rounded-xl border p-4 ${e.color}`}>
                <p className="font-semibold text-sm">{e.level}</p>
                <p className="mt-0.5 text-xs opacity-90">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Appeals */}
        <div className="rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>Appeals:</strong> If you believe a moderation action was taken in error, you may appeal by emailing{" "}
          <a href="mailto:hello@visionex.app" className="text-primary underline">hello@visionex.app</a>{" "}
          within 14 days of the action. Include your username and a description of the situation. Permanent bans for severe violations (illegal content, child safety) are not subject to appeal.
        </div>
      </section>
    </Layout>
  );
}
