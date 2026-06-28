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

export default function AdminInfra() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <Shield className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold">Global Infrastructure Dashboard</h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Multi-region SRE view · Auto-refreshes every 30s
            </p>
          </div>

          {/* Global health pill */}
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] text-green-400 font-semibold">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            4/5 REGIONS HEALTHY
          </div>

          <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)} className="gap-1.5 shrink-0">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>

          <Button size="sm" variant="ghost" asChild className="shrink-0">
            <a href="https://grafana.internal.visionex.ai" target="_blank" rel="noreferrer" className="gap-1.5 flex items-center">
              <ExternalLink className="size-3.5" /> Grafana
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
            <TabsTrigger value="overview"   className="gap-1.5"><Globe      className="size-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="analytics"  className="gap-1.5"><BarChart2  className="size-3.5" /> AI Analytics</TabsTrigger>
            <TabsTrigger value="providers"  className="gap-1.5"><Cpu        className="size-3.5" /> Providers</TabsTrigger>
            <TabsTrigger value="revenue"    className="gap-1.5"><DollarSign className="size-3.5" /> Revenue</TabsTrigger>
            <TabsTrigger value="security"   className="gap-1.5"><Shield     className="size-3.5" /> Security</TabsTrigger>
            <TabsTrigger value="alerts"     className="gap-1.5">
              <Bell className="size-3.5" /> Alerts
              <Badge className="bg-yellow-500/80 text-white text-[9px] px-1 py-0 ml-0.5">2</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="size-4 text-primary" /> Region Health Map
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
                <p className="text-xs font-semibold mb-3">Service Health</p>
                {[
                  { label: "API Gateway",       ok: true,  detail: "99.98% uptime · P95 142ms" },
                  { label: "AI Workers",        ok: true,  detail: "55 pods across 5 regions" },
                  { label: "Provider Hub",      ok: true,  detail: "Smart routing active" },
                  { label: "Billing Engine",    ok: true,  detail: "100% · P95 28ms" },
                  { label: "Redis Clusters",    ok: true,  detail: "5 HA instances · <2ms" },
                  { label: "CDN / Cloud CDN",   ok: true,  detail: "Cache hit 94.2%" },
                  { label: "WAF / Cloud Armor", ok: true,  detail: "14,820 requests blocked (24h)" },
                  { label: "Vault (Secrets)",   ok: true,  detail: "Sealed · GCP KMS autounseal" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className={`size-2 rounded-full shrink-0 ${s.ok ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
                    <span className="text-xs font-medium w-40 shrink-0">{s.label}</span>
                    <span className="text-[11px] text-muted-foreground">{s.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── AI Analytics ──────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Speech Gens (24h)",  value: "84,320",  color: "text-blue-400"   },
                { label: "Video Gens (24h)",   value: "2,840",   color: "text-violet-400" },
                { label: "Voice Clones (24h)", value: "420",     color: "text-pink-400"   },
                { label: "Overall Success",    value: "97.4%",   color: "text-green-400"  },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* 24h volume chart */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-4">AI Generation Volume — Last 24h</p>
              <div className="flex items-end gap-0.5 h-28">
                {Array.from({ length: 48 }, (_, i) => {
                  const pct = 20 + Math.sin((i / 48) * Math.PI * 3) * 30 + Math.random() * 25;
                  const isVideo = i % 3 === 0;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all hover:opacity-100 opacity-75 ${isVideo ? "bg-violet-500" : "bg-primary"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={`${Math.round(pct * 20)} ops`}
                    />
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Speech/Voice</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-violet-500" /> Video</span>
              </div>
            </div>

            {/* Queue health per region */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold">Queue Depth by Region</p>
              {[
                { region: "🇪🇺 Europe",      depth: 34,  workers: 12 },
                { region: "🇦🇪 Middle East", depth: 12,  workers: 6  },
                { region: "🇺🇸 US East",     depth: 58,  workers: 18 },
                { region: "🇺🇸 US West",     depth: 221, workers: 10 },
                { region: "🇯🇵 Asia",        depth: 27,  workers: 9  },
              ].map((q) => (
                <div key={q.region} className="flex items-center gap-3 text-xs">
                  <span className="w-36 shrink-0">{q.region}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${q.depth > 100 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, (q.depth / 300) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{q.depth}</span>
                  <span className="text-muted-foreground w-24 text-right">{q.workers} workers</span>
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
                { label: "WAF Blocks (24h)",   value: "14,820", color: "text-red-400"    },
                { label: "Rate Limits (24h)",  value: "3,241",  color: "text-yellow-400" },
                { label: "Auth Failures",      value: "892",    color: "text-orange-400" },
                { label: "DDoS Events",        value: "2",      color: "text-green-400"  },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
              <p className="text-xs font-semibold mb-3">Security Controls</p>
              {[
                { ctrl: "Cloud Armor WAF",         on: true,  detail: "OWASP Top 10 + SQLi + XSS + RCE rules" },
                { ctrl: "DDoS Protection (L7)",    on: true,  detail: "Adaptive + rate-based ban" },
                { ctrl: "Rate Limiting per-IP",    on: true,  detail: "1,000 req/min · 5 min ban" },
                { ctrl: "Rate Limiting per-user",  on: true,  detail: "300 req/min via X-User-ID header" },
                { ctrl: "JWT RS256 + rotation",    on: true,  detail: "1h expiry · JWKS endpoint" },
                { ctrl: "Vault secrets management",on: true,  detail: "GCP KMS auto-unseal · all API keys sealed" },
                { ctrl: "TLS 1.3 everywhere",      on: true,  detail: "HSTS preload · cert auto-renewed (ManagedCertificate)" },
                { ctrl: "Signed CDN URLs",         on: true,  detail: "1h expiry · daily key rotation" },
                { ctrl: "Network Policies",        on: true,  detail: "Default-deny + explicit allowlists per namespace" },
                { ctrl: "Pod Security (Restricted)",on: true, detail: "No root · read-only rootfs · drop ALL caps" },
                { ctrl: "Binary Authorization",    on: true,  detail: "Only GCR-signed images admitted" },
                { ctrl: "Audit Logs → BigQuery",   on: true,  detail: "All billing + auth events · 90d retention" },
              ].map((s) => (
                <div key={s.ctrl} className="flex items-start gap-3">
                  <span className={`mt-1 size-2 rounded-full shrink-0 ${s.on ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-xs font-medium w-52 shrink-0">{s.ctrl}</span>
                  <span className="text-[11px] text-muted-foreground">{s.detail}</span>
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
