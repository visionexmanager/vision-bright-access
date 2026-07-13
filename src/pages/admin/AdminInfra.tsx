// Global Infrastructure Admin Dashboard — Visionex AMS
// Covers: regional health, live metrics, providers, revenue, security, alerts
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe, BarChart2, Cpu, DollarSign, Bell, Shield, RefreshCw, ExternalLink,
} from "lucide-react";
import { LiveMetricsBar }      from "./components/LiveMetricsBar";
import { RegionStatusMap }     from "./components/RegionStatusMap";
import { AlertsFeed }          from "./components/AlertsFeed";
import { ProviderLeaderboard } from "./components/ProviderLeaderboard";
import { RevenueAnalytics }    from "./components/RevenueAnalytics";
import { useLanguage } from "@/contexts/LanguageContext";

const SERVICE_HEALTH: { key: string; ok: boolean }[] = [
  { key: "apiGateway",    ok: true },
  { key: "aiWorkers",     ok: true },
  { key: "providerHub",   ok: true },
  { key: "billingEngine", ok: true },
  { key: "redisClusters", ok: true },
  { key: "cdn",           ok: true },
  { key: "waf",           ok: true },
  { key: "vault",         ok: true },
];

const QUEUE_REGIONS: { key: string; depth: number; workers: number }[] = [
  { key: "europe",     depth: 34,  workers: 12 },
  { key: "middleEast", depth: 12,  workers: 6  },
  { key: "usEast",     depth: 58,  workers: 18 },
  { key: "usWest",     depth: 221, workers: 10 },
  { key: "asia",       depth: 27,  workers: 9  },
];

const SECURITY_CONTROLS: { key: string; on: boolean }[] = [
  { key: "cloudArmorWaf",  on: true },
  { key: "ddosProtection", on: true },
  { key: "rateLimitIp",    on: true },
  { key: "rateLimitUser",  on: true },
  { key: "jwtRotation",    on: true },
  { key: "vaultSecrets",   on: true },
  { key: "tls",            on: true },
  { key: "signedCdn",      on: true },
  { key: "networkPolicies",on: true },
  { key: "podSecurity",    on: true },
  { key: "binaryAuth",     on: true },
  { key: "auditLogs",      on: true },
];

export default function AdminInfra() {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <Shield className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold">{t("admin.infra.title")}</h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              {t("admin.infra.subtitle")}
            </p>
          </div>

          {/* Global health pill */}
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] text-green-400 font-semibold">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            {t("admin.infra.regionsHealthy")}
          </div>

          <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)} className="gap-1.5 shrink-0">
            <RefreshCw className="size-3.5" /> {t("admin.infra.refresh")}
          </Button>

          <Button size="sm" variant="ghost" asChild className="shrink-0">
            <a href="https://grafana.internal.visionex.ai" target="_blank" rel="noreferrer" className="gap-1.5 flex items-center">
              <ExternalLink className="size-3.5" /> {t("admin.infra.grafana")}
            </a>
          </Button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* ── Live Metrics Strip ──────────────────────────────────────────── */}
        <LiveMetricsBar key={refreshKey} />

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview"   className="gap-1.5"><Globe      className="size-3.5" /> {t("admin.infra.tab.overview")}</TabsTrigger>
            <TabsTrigger value="analytics"  className="gap-1.5"><BarChart2  className="size-3.5" /> {t("admin.infra.tab.analytics")}</TabsTrigger>
            <TabsTrigger value="providers"  className="gap-1.5"><Cpu        className="size-3.5" /> {t("admin.infra.tab.providers")}</TabsTrigger>
            <TabsTrigger value="revenue"    className="gap-1.5"><DollarSign className="size-3.5" /> {t("admin.infra.tab.revenue")}</TabsTrigger>
            <TabsTrigger value="security"   className="gap-1.5"><Shield     className="size-3.5" /> {t("admin.infra.tab.security")}</TabsTrigger>
            <TabsTrigger value="alerts"     className="gap-1.5">
              <Bell className="size-3.5" /> {t("admin.infra.tab.alerts")}
              <Badge className="bg-yellow-500/80 text-white text-[9px] px-1 py-0 ml-0.5">2</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="size-4 text-primary" /> {t("admin.infra.regionHealthMap")}
              </p>
              <RegionStatusMap key={refreshKey} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alerts */}
              <div className="rounded-xl border border-border bg-card p-4">
                <AlertsFeed key={refreshKey} />
              </div>

              {/* Service health */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold mb-3">{t("admin.infra.serviceHealth")}</p>
                {SERVICE_HEALTH.map((s) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className={`size-2 rounded-full shrink-0 ${s.ok ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
                    <span className="text-xs font-medium w-40 shrink-0">{t(`admin.infra.service.${s.key}.label`)}</span>
                    <span className="text-[11px] text-muted-foreground">{t(`admin.infra.service.${s.key}.detail`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── AI Analytics ──────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { key: "speechGens",     value: "84,320",  color: "text-blue-400"   },
                { key: "videoGens",      value: "2,840",   color: "text-violet-400" },
                { key: "voiceClones",    value: "420",     color: "text-pink-400"   },
                { key: "overallSuccess", value: "97.4%",   color: "text-green-400"  },
              ].map((c) => (
                <div key={c.key} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t(`admin.infra.analytics.${c.key}`)}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* 24h volume chart */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-4">{t("admin.infra.analytics.volumeChartTitle")}</p>
              <div className="flex items-end gap-0.5 h-28">
                {Array.from({ length: 48 }, (_, i) => {
                  const pct = 20 + Math.sin((i / 48) * Math.PI * 3) * 30 + Math.random() * 25;
                  const isVideo = i % 3 === 0;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all hover:opacity-100 opacity-75 ${isVideo ? "bg-violet-500" : "bg-primary"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={`${Math.round(pct * 20)} ${t("admin.infra.analytics.opsUnit")}`}
                    />
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> {t("admin.infra.analytics.legendSpeechVoice")}</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-violet-500" /> {t("admin.infra.analytics.legendVideo")}</span>
              </div>
            </div>

            {/* Queue health per region */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold">{t("admin.infra.analytics.queueDepthTitle")}</p>
              {QUEUE_REGIONS.map((q) => (
                <div key={q.key} className="flex items-center gap-3 text-xs">
                  <span className="w-36 shrink-0">{t(`admin.infra.region.${q.key}`)}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${q.depth > 100 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, (q.depth / 300) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{q.depth}</span>
                  <span className="text-muted-foreground w-24 text-right">{q.workers} {t("admin.infra.analytics.workersUnit")}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Providers ─────────────────────────────────────────────────── */}
          <TabsContent value="providers" className="mt-6">
            <ProviderLeaderboard key={refreshKey} />
          </TabsContent>

          {/* ── Revenue ───────────────────────────────────────────────────── */}
          <TabsContent value="revenue" className="mt-6">
            <RevenueAnalytics key={refreshKey} />
          </TabsContent>

          {/* ── Security ──────────────────────────────────────────────────── */}
          <TabsContent value="security" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { key: "wafBlocks",    value: "14,820", color: "text-red-400"    },
                { key: "rateLimits",   value: "3,241",  color: "text-yellow-400" },
                { key: "authFailures", value: "892",    color: "text-orange-400" },
                { key: "ddosEvents",   value: "2",      color: "text-green-400"  },
              ].map((c) => (
                <div key={c.key} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] text-muted-foreground uppercase">{t(`admin.infra.security.${c.key}`)}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
              <p className="text-xs font-semibold mb-3">{t("admin.infra.security.controlsTitle")}</p>
              {SECURITY_CONTROLS.map((s) => (
                <div key={s.key} className="flex items-start gap-3">
                  <span className={`mt-1 size-2 rounded-full shrink-0 ${s.on ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-xs font-medium w-52 shrink-0">{t(`admin.infra.security.${s.key}.label`)}</span>
                  <span className="text-[11px] text-muted-foreground">{t(`admin.infra.security.${s.key}.detail`)}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Alerts ────────────────────────────────────────────────────── */}
          <TabsContent value="alerts" className="mt-6 max-w-3xl">
            <div className="rounded-xl border border-border bg-card p-4">
              <AlertsFeed key={refreshKey} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
