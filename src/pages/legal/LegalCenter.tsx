import { lazy, Suspense, useState } from "react";
import { Layout, EmbeddedLayout } from "@/components/Layout";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowRight, Shield, ShoppingBag, Brain, Scale, Lock, Users, FileText, Accessibility, TriangleAlert, Copyright, Coins, ShieldCheck, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

/* Lazy-load policy content — only fetched when a user clicks a policy card */
const PrivacyPolicy       = lazy(() => import("./PrivacyPolicy"));
const TermsOfUse          = lazy(() => import("./TermsOfUse"));
const CommunityGuidelines = lazy(() => import("./CommunityGuidelines"));
const AccessibilityStatement = lazy(() => import("./AccessibilityStatement"));
const LegalDisclaimer     = lazy(() => import("./LegalDisclaimer"));
const MarketplacePolicy   = lazy(() => import("./MarketplacePolicy"));
const BuyerProtection     = lazy(() => import("./BuyerProtection"));
const VXCoinsPolicy       = lazy(() => import("./VXCoinsPolicy"));
const IntellectualProperty = lazy(() => import("./IntellectualProperty"));
const AIPolicy            = lazy(() => import("./AIPolicy"));
const EnforcementAppeals  = lazy(() => import("./EnforcementAppeals"));

type PolicyKey =
  | "privacy" | "terms" | "community" | "accessibility" | "disclaimer"
  | "marketplace" | "buyer" | "vxcoins" | "ip" | "ai" | "enforcement";

const POLICY_COMPONENTS: Record<PolicyKey, React.LazyExoticComponent<() => JSX.Element>> = {
  privacy:       PrivacyPolicy,
  terms:         TermsOfUse,
  community:     CommunityGuidelines,
  accessibility: AccessibilityStatement,
  disclaimer:    LegalDisclaimer,
  marketplace:   MarketplacePolicy,
  buyer:         BuyerProtection,
  vxcoins:       VXCoinsPolicy,
  ip:            IntellectualProperty,
  ai:            AIPolicy,
  enforcement:   EnforcementAppeals,
};

const CORE_POLICIES: { key: PolicyKey; icon: React.ElementType; labelKey: string; descKey: string }[] = [
  { key: "privacy",       icon: Lock,          labelKey: "footer.link.privacyPolicy",       descKey: "legalCenter.desc.privacy" },
  { key: "terms",         icon: FileText,       labelKey: "footer.link.termsOfUse",          descKey: "legalCenter.desc.terms" },
  { key: "community",     icon: Users,          labelKey: "footer.link.communityGuidelines", descKey: "legalCenter.desc.community" },
  { key: "accessibility", icon: Accessibility,  labelKey: "footer.link.accessibility",       descKey: "legalCenter.desc.accessibility" },
  { key: "disclaimer",    icon: TriangleAlert,  labelKey: "footer.link.legalDisclaimer",     descKey: "legalCenter.desc.disclaimer" },
];

const MARKETPLACE_POLICIES: { key: PolicyKey; icon: React.ElementType; labelKey: string; descKey: string }[] = [
  { key: "marketplace", icon: ShoppingBag, labelKey: "footer.link.marketplacePolicy",   descKey: "legalCenter.desc.marketplace" },
  { key: "buyer",       icon: ShieldCheck, labelKey: "footer.link.buyerProtection",      descKey: "legalCenter.desc.buyer" },
  { key: "vxcoins",     icon: Coins,       labelKey: "footer.link.vxCoinsPolicy",        descKey: "legalCenter.desc.vxcoins" },
  { key: "ip",          icon: Copyright,   labelKey: "footer.link.intellectualProperty", descKey: "legalCenter.desc.ip" },
];

const PLATFORM_POLICIES: { key: PolicyKey; icon: React.ElementType; labelKey: string; descKey: string }[] = [
  { key: "ai",          icon: Brain, labelKey: "footer.link.aiPolicy",           descKey: "legalCenter.desc.ai" },
  { key: "enforcement", icon: Scale, labelKey: "footer.link.enforcementAppeals", descKey: "legalCenter.desc.enforcement" },
];

interface PolicyCardProps {
  policyKey: PolicyKey;
  icon: React.ElementType;
  label: string;
  desc: string;
  onOpen: (key: PolicyKey, label: string) => void;
}

function PolicyCard({ policyKey, icon: Icon, label, desc, onOpen }: PolicyCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(policyKey, label)}
      className="group flex w-full items-start gap-4 rounded-2xl border bg-card p-5 text-start transition-all hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
    </button>
  );
}

export default function LegalCenter() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<PolicyKey | null>(null);
  const [activeTitle, setActiveTitle] = useState("");

  const handleOpen = (key: PolicyKey, label: string) => {
    setActiveKey(key);
    setActiveTitle(label);
    setOpen(true);
  };

  const ActiveComponent = activeKey ? POLICY_COMPONENTS[activeKey] : null;

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
                key={p.key}
                policyKey={p.key}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
                onOpen={handleOpen}
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
                key={p.key}
                policyKey={p.key}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
                onOpen={handleOpen}
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
                key={p.key}
                policyKey={p.key}
                icon={p.icon}
                label={t(p.labelKey)}
                desc={t(p.descKey)}
                onOpen={handleOpen}
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

      {/* Policy Sheet — renders policy content without Navbar/Footer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-2xl"
          aria-label={activeTitle}
        >
          <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b bg-card/95 px-5 py-3 backdrop-blur">
            <SheetTitle className="text-base font-semibold">{activeTitle}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setOpen(false)}
              aria-label={t("nav.closeMenu")}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>
          {ActiveComponent && (
            <EmbeddedLayout>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                }
              >
                <ActiveComponent />
              </Suspense>
            </EmbeddedLayout>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
