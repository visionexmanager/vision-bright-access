import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { SETTINGS_ROLES } from "@/features/visionkids/data/platformConfig";
import { PlatformHeader } from "@/features/visionkids/components/platform/PlatformHeader";

const ROLE_META: Record<string, { emoji: string; to: string }> = {
  child: { emoji: "🧒", to: "/kids/settings" },
  parent: { emoji: "👨‍👩‍👧", to: "/kids/parents" },
  teacher: { emoji: "🧑‍🏫", to: "/kids/market/teacher" },
  school: { emoji: "🏫", to: "/kids/platform/analytics" },
  creator: { emoji: "🎨", to: "/kids/market/creator" },
  admin: { emoji: "🛡️", to: "/kids/platform/marketplace" },
};

export default function PlatformSettings() {
  const { t } = useLanguage();
  useDocumentHead({
    title: `${t("kids.platform.nav.settings")} — VisionKids`,
    description: t("kids.platform.settings.subtitle"),
    canonicalPath: "/kids/platform/settings",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PlatformHeader emoji="⚙️" title={t("kids.platform.nav.settings")} subtitle={t("kids.platform.settings.subtitle")} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SETTINGS_ROLES.map((role) => {
          const meta = ROLE_META[role];
          return (
            <Link key={role} to={meta.to}
              className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-transform hover:scale-[1.02] hover:border-kids-primary/50">
              <span className="text-3xl" aria-hidden="true">{meta.emoji}</span>
              <div>
                <p className="font-heading font-bold leading-tight">{t(`kids.platform.role.${role}`)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(`kids.platform.roleDesc.${role}`)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
