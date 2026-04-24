import { Layout } from "@/components/Layout";
import { ShoppingBag, ShieldX, AlertTriangle, CheckCircle2, Gavel } from "lucide-react";

const PROHIBITED = [
  { emoji: "🚫", title: "Alcohol & Tobacco", desc: "All alcoholic beverages, tobacco products, e-cigarettes, vaping products, and related paraphernalia." },
  { emoji: "🔫", title: "Weapons & Dangerous Items", desc: "Firearms, ammunition, bladed weapons, explosives, tasers, and realistic weapon replicas." },
  { emoji: "💊", title: "Drugs & Controlled Substances", desc: "Illegal drugs, prescription medications without valid authorization, and any substances that mimic controlled drugs." },
  { emoji: "🔞", title: "Adult & Sexual Content", desc: "Pornographic material, sexually explicit products, adult toys, or any content unsuitable for a general audience." },
  { emoji: "🎰", title: "Gambling & Betting", desc: "Casino equipment, lottery services, gambling chips, or any product used to facilitate illegal gambling." },
  { emoji: "🧬", title: "Unverified Health Claims", desc: "Products claiming to cure, treat, or prevent diseases without scientific proof or regulatory approval." },
  { emoji: "📦", title: "Counterfeit & Stolen Goods", desc: "Fake branded goods, pirated content, stolen items, or any product infringing on intellectual property rights." },
  { emoji: "☢️", title: "Hazardous Materials", desc: "Radioactive materials, toxic chemicals, flammable liquids, and any substance posing a public safety risk." },
  { emoji: "🐾", title: "Protected Animals & Wildlife", desc: "Endangered species, illegal animal products (ivory, fur from protected animals), live animals." },
  { emoji: "📊", title: "Pyramid Schemes & MLM", desc: "Multi-level marketing schemes, pyramid structures, or any product whose primary value is recruitment-based." },
  { emoji: "🔏", title: "Personal Data & Privacy", desc: "Selling personal information, user databases, private contact lists, or any data collected without consent." },
  { emoji: "⚔️", title: "Hate & Discrimination", desc: "Products, symbols, or merchandise that promote hatred, discrimination, or violence against any group." },
];

const ALLOWED = [
  "Assistive technology products (screen readers, Braille devices, magnifiers, etc.)",
  "Educational materials, books, courses, and digital learning resources",
  "Software, apps, and digital tools that comply with platform guidelines",
  "Arts, crafts, and handmade goods",
  "Electronics and technology accessories",
  "Clothing and fashion items (modest and appropriate)",
  "Home goods, furniture, and décor",
  "Health and wellness products with verified, honest claims",
  "Services (consulting, design, tutoring, accessibility services)",
];

const ENFORCEMENT = [
  { title: "Listing Removal", desc: "Prohibited listings are removed immediately without notice." },
  { title: "Shop Suspension", desc: "Repeated violations result in temporary or permanent shop suspension. VX coins used to open the shop are forfeited." },
  { title: "Account Ban", desc: "Severe or repeated violations may result in permanent account termination." },
  { title: "Legal Action", desc: "Visionex reserves the right to report illegal activity to relevant authorities." },
];

export default function MarketplacePolicy() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShoppingBag className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">VXBazaar Marketplace Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: April 2026</p>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="leading-relaxed text-muted-foreground">
            VXBazaar is an inclusive marketplace hosted on Visionex, designed to empower sellers and serve a diverse global community — including users with visual impairments and accessibility needs. All sellers and buyers must adhere to this policy to maintain a safe, respectful, and legal marketplace environment.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Visionex acts as a platform facilitating connections between buyers and sellers. Sellers are solely responsible for the legality and accuracy of their listings.
          </p>
        </div>

        {/* Prohibited */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold">Strictly Prohibited Items</h2>
          </div>
          <div className="space-y-3">
            {PROHIBITED.map((item, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border bg-card p-4">
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Age restriction */}
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold">Age-Restricted Products (18+)</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Certain products require buyer age verification. Sellers listing age-restricted items (such as some health supplements or professional tools) must clearly mark listings as 18+ and are responsible for ensuring compliance with local laws. Visionex reserves the right to remove any age-restricted listing that cannot be properly verified.
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
            Note: Products primarily marketed to minors must never include adult themes, violent imagery, or inappropriate content.
          </p>
        </div>

        {/* What's allowed */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-bold">What You Can Sell</h2>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <ul className="space-y-2.5">
              {ALLOWED.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Seller responsibilities */}
        <div className="mb-8 rounded-2xl border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold">Seller Responsibilities</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Provide accurate, honest product descriptions, images, and pricing.</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Ensure all products comply with the laws of the seller's country and the buyer's country.</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Respond to buyer inquiries in a timely and respectful manner.</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Pay monthly VXBazaar shop rent on time. Failure to pay will result in shop deactivation.</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Not engage in price manipulation, fake reviews, or misleading promotions.</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Keep product inventory up to date and mark out-of-stock items accordingly.</li>
          </ul>
        </div>

        {/* Enforcement */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Enforcement Actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENFORCEMENT.map((item, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border bg-muted/50 p-5 text-sm text-muted-foreground">
          <strong>Policy Updates:</strong> This policy may be updated at any time. Continued use of VXBazaar constitutes acceptance of the latest version. For questions or to report a violation, contact us at{" "}
          <a href="mailto:hello@visionex.app" className="text-primary underline">hello@visionex.app</a>.
        </div>
      </section>
    </Layout>
  );
}
