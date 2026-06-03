import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, ShoppingBag, Brain, Scale, Lock, Users, FileText, Accessibility, TriangleAlert, Copyright, Coins, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CORE_POLICIES = [
  { to: "/privacy-policy",       icon: Lock,          labelKey: "footer.link.privacyPolicy",       descKey: "legalCenter.desc.privacy" },
  { to: "/terms-of-use",         icon: FileText,       labelKey: "footer.link.termsOfUse",          descKey: "legalCenter.desc.terms" },
  { to: "/community-guidelines", icon: Users,          labelKey: "footer.link.communityGuidelines", descKey: "legalCenter.desc.community" },
  { to: "/accessibility",        icon: Accessibility,  labelKey: "footer.link.accessibility",       descKey: "legalCenter.desc.accessibility" },
  { to: "/legal-disclaimer",     icon: TriangleAlert,  labelKey: "footer.link.legalDisclaimer",     descKey: "legalCenter.desc.disclaimer" },
];

const MARKETPLACE_POLICIES = [
  { to: "/marketplace-policy",   icon: ShoppingBag,   labelKey: "footer.link.marketplacePolicy",   descKey: "legalCenter.desc.marketplace" },
  { to: "/buyer-protection",     icon: ShieldCheck,   labelKey: "footer.link.buyerProtection",      descKey: "legalCenter.desc.buyer" },
  { to: "/vx-coins-policy",      icon: Coins,         labelKey: "footer.link.vxCoinsPolicy",        descKey: "legalCenter.desc.vxcoins" },
  { to: "/intellectual-property",icon: Copyright,     labelKey: "footer.link.intellectualProperty", descKey: "legalCenter.desc.ip" },
];

const PLATFORM_POLICIES = [
  { to: "/ai-policy",            icon: Brain,         labelKey: "footer.link.aiPolicy",             descKey: "legalCenter.desc.ai" },
  { to: "/enforcement-appeals",  icon: Scale,         labelKey: "footer.link.enforcementAppeals",   descKey: "legalCenter.desc.enforcement" },
];

interface PolicyCardProps {
  to: string;
  icon: React.ElementType;
  label: string;
  desc: string;
}

function PolicyCard({ to, icon: Icon, label, desc }: PolicyCardProps) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}

export default function LegalCenter() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legalCenter.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legalCenter.subtitle")}</p>
          </div>
        </div>

        <p className="mb-10 leading-relaxed text-muted-foreground">{t("legalCenter.intro")}</p>

        {/* Core Policies */}
        <div className="mb-10">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Shield className="h-3.5 w-3.5" />
            {t("legalCenter.section.core")}
          </div>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("legalCenter.section.coreDesc")}</p>
          <div className="space-y-3">
            {CORE_POLICIES.map((p) => (
              <PolicyCard
                key={p.to}
                to={p.to}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
              />
            ))}
          </div>
        </div>

        {/* Marketplace */}
        <div className="mb-10">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <ShoppingBag className="h-3.5 w-3.5" />
            {t("legalCenter.section.marketplace")}
          </div>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("legalCenter.section.marketplaceDesc")}</p>
          <div className="space-y-3">
            {MARKETPLACE_POLICIES.map((p) => (
              <PolicyCard
                key={p.to}
                to={p.to}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
              />
            ))}
          </div>
        </div>

        {/* Platform Governance */}
        <div className="mb-10">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Brain className="h-3.5 w-3.5" />
            {t("legalCenter.section.platform")}
          </div>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("legalCenter.section.platformDesc")}</p>
          <div className="space-y-3">
            {PLATFORM_POLICIES.map((p) => (
              <PolicyCard
                key={p.to}
                to={p.to}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
              />
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm font-semibold mb-1">{t("legalCenter.contactTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("legalCenter.contactBody")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
