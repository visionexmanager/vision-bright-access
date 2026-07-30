import { Smartphone, Monitor, Tv, Globe, LogOut } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useDevices, useSignOutDevice, useSignOutAllDevices } from "@/features/visionkids/hooks/everywhere/useEverywhere";
import { getDeviceKey } from "@/features/visionkids/everywhere/platform";
import { EverywhereHeader } from "@/features/visionkids/components/everywhere/EverywhereShell";
import type { Platform } from "@/features/visionkids/types/everywhere.types";

const ICON: Record<Platform, typeof Smartphone> = {
  web: Globe, pwa: Globe, android: Smartphone, ios: Smartphone, windows: Monitor, macos: Monitor, tv: Tv,
};

export default function MyDevices() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: devices = [], isLoading } = useDevices();
  const signOut = useSignOutDevice();
  const signOutAll = useSignOutAllDevices();
  const thisKey = getDeviceKey();

  useDocumentHead({ title: `${t("kids.everywhere.nav.devices")} — VisionKids`, description: t("kids.everywhere.devices.subtitle"), canonicalPath: "/kids/everywhere/devices" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EverywhereHeader emoji="📱" title={t("kids.everywhere.nav.devices")} subtitle={t("kids.everywhere.devices.subtitle")} />
      {!user ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.everywhere.signInHint")}</p>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-2">
            {devices.map((d) => {
              const Icon = ICON[d.platform] ?? Globe;
              const isThis = d.device_key === thisKey;
              return (
                <li key={d.id} className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${isThis ? "border-kids-primary bg-kids-primary/5" : "border-border bg-card"}`}>
                  <Icon className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold leading-tight">{d.name} {isThis && <span className="text-xs font-semibold text-kids-primary">· {t("kids.everywhere.devices.thisDevice")}</span>}</p>
                    <p className="text-xs text-muted-foreground">{t(`kids.everywhere.platform.${d.platform}`)}{d.app_version && ` · v${d.app_version}`} · {t("kids.everywhere.devices.lastActive")} {new Date(d.last_active).toLocaleDateString()}</p>
                  </div>
                  {!isThis && (
                    <button type="button" onClick={() => signOut.mutate(d.id)} disabled={signOut.isPending}
                      className="inline-flex items-center gap-1 rounded-full border-2 border-border px-3 py-1.5 text-xs font-bold hover:border-kids-pink/50 disabled:opacity-50">
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.everywhere.devices.signOut")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {devices.length > 1 && (
            <button type="button" onClick={() => signOutAll.mutate()} disabled={signOutAll.isPending}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-kids-pink px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
              <LogOut className="h-4 w-4" aria-hidden="true" /> {t("kids.everywhere.devices.signOutAll")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
