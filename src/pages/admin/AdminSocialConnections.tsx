// Phase 9, step 3 — the connection screen.
//
// One row per platform, and the question it answers is "why can this not
// publish yet", not "is there a green dot". Six distinguishable states, because
// each has a different fix and a single indicator would hide which one applies:
//
//   secrets missing  - this deployment holds no credentials for the platform
//   blocked          - something outside the code is missing (LinkedIn's page)
//   not reviewed     - connected identity, no recorded platform review
//   not permitted    - the platform did not grant the publishing scope
//   expired          - the grant exists and has run out
//   connected        - a live grant that carries the publishing scope
//
// Nothing here ever holds a token. The status endpoint returns environment
// variable NAMES and connection facts; the tokens themselves are unreadable
// from any browser session, admin included.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, Link2, Loader2, Plug, RefreshCw, Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

type ProviderRow = {
  platform: string;
  label: string;
  configured: boolean;
  missing_secrets: string[];
  blocked_reason: string | null;
  requested_scopes: string[];
  publish_scope: string;
};

type AccountRow = {
  account_id: string;
  platform: string;
  handle: string;
  status: string;
  connection: "not_reviewed" | "not_permitted" | "not_connected" | "expired" | "connected";
  granted_scopes: string[];
  token_expires_at: string | null;
  can_refresh: boolean;
  publishing_permission_granted: boolean;
  review_completed_at: string | null;
  last_connected_at: string | null;
  health_score: number;
  consecutive_failures: number;
};

type StatusResponse = {
  ok: boolean;
  providers: ProviderRow[];
  accounts: AccountRow[];
  redirect_uri: string;
  encryption_key_present: boolean;
  state_secret_present: boolean;
};

/**
 * The outcomes the callback redirects back with, folded onto the messages an
 * operator can act on.
 *
 * The function distinguishes more codes than this — a malformed state and an
 * expired one are different bugs — but they have one remedy between them
 * ("start again"), and five near-identical sentences in twenty languages is
 * worse for the reader than one accurate sentence. The precise code stays in
 * the URL and in the function's own reasoning.
 */
const OUTCOMES: Record<string, { tone: "success" | "warning" | "error"; key: string }> = {
  connected: { tone: "success", key: "connected" },
  connected_without_publishing: { tone: "warning", key: "connectedWithoutPublishing" },
  declined: { tone: "warning", key: "declined" },
  state_expired: { tone: "warning", key: "attemptExpired" },
  state_missing: { tone: "warning", key: "attemptExpired" },
  state_invalid: { tone: "warning", key: "attemptExpired" },
  state_malformed: { tone: "warning", key: "attemptExpired" },
  state_incomplete: { tone: "warning", key: "attemptExpired" },
  code_missing: { tone: "warning", key: "attemptExpired" },
  not_configured: { tone: "error", key: "notConfigured" },
  store_failed: { tone: "error", key: "failed" },
  token_exchange_rejected: { tone: "error", key: "failed" },
  token_response_unreadable: { tone: "error", key: "failed" },
  token_response_missing_access_token: { tone: "error", key: "failed" },
};

/** Action errors that have their own remedy. Everything else is generic. */
const ACTION_ERRORS = new Set([
  "not_configured",
  "encryption_key_missing",
  "handle_required",
  "reconnect_required",
  "no_refresh_token",
  "linkedin_company_page_missing",
]);

function errorKey(code: unknown): string {
  return typeof code === "string" && ACTION_ERRORS.has(code)
    ? `social.error.${code}`
    : "social.error.generic";
}

export default function AdminSocialConnections() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [handles, setHandles] = useState<Record<string, string>>({});

  useDocumentHead({
    title: t("social.connections.title"),
    description: t("social.connections.subtitle"),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("social-oauth", {
      body: { action: "status" },
    });
    if (error || !data?.ok) {
      toast.error(t("social.connections.loadFailed"));
      setStatus(null);
    } else {
      setStatus(data as StatusResponse);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // The callback redirects back here with a result code. It is reported once
  // and then removed from the URL, so a reload does not repeat a stale message.
  useEffect(() => {
    const outcome = params.get("connection");
    if (!outcome) return;
    const platform = params.get("platform");
    const label = platform ? t(`content.platform.${platform}`) : "";
    const resolved = OUTCOMES[outcome] ?? { tone: "error" as const, key: "failed" };
    const message = `${t(`social.outcome.${resolved.key}`)}${label ? ` — ${label}` : ""}`;
    if (resolved.tone === "success") toast.success(message);
    else if (resolved.tone === "warning") toast.warning(message);
    else toast.error(message);

    const next = new URLSearchParams(params);
    next.delete("connection");
    next.delete("platform");
    setParams(next, { replace: true });
  }, [params, setParams, t]);

  const accountsByPlatform = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const account of status?.accounts ?? []) map.set(account.platform, account);
    return map;
  }, [status]);

  const call = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    const { data, error } = await supabase.functions.invoke("social-oauth", { body });
    setBusy(null);
    if (error) {
      toast.error(t("social.connections.actionFailed"));
      return null;
    }
    return data;
  };

  const connect = async (provider: ProviderRow) => {
    const handle = (handles[provider.platform] ?? "").trim();
    if (!handle) {
      toast.error(t("social.connections.handleRequired"));
      return;
    }
    const data = await call(provider.platform, {
      action: "start",
      platform: provider.platform,
      handle,
      return_to: "/admin/social-connections",
    });
    if (!data) return;
    if (!data.ok) {
      toast.error(t(errorKey(data.error)));
      return;
    }
    // A full navigation, not a popup: the platform's consent screen refuses to
    // render inside a frame, and a popup here is the thing browsers block.
    window.location.href = data.authorize_url;
  };

  const refresh = async (account: AccountRow) => {
    const data = await call(account.account_id, {
      action: "refresh", account_id: account.account_id,
    });
    if (!data) return;
    if (data.ok) toast.success(t("social.connections.refreshed"));
    else toast.error(t(errorKey(data.error)));
    await load();
  };

  const disconnect = async (account: AccountRow) => {
    const data = await call(account.account_id, {
      action: "disconnect", account_id: account.account_id,
    });
    if (!data) return;
    if (data.ok) toast.success(t("social.connections.disconnected"));
    else toast.error(t("social.connections.actionFailed"));
    await load();
  };

  /** What is actually wrong, in the order the operator has to fix it. */
  const stateOf = (provider: ProviderRow, account: AccountRow | undefined) => {
    if (provider.blocked_reason) return "blocked";
    if (!provider.configured) return "secrets_missing";
    if (!account) return "not_connected";
    return account.connection;
  };

  const STATE_STYLE: Record<string, { icon: typeof Plug; className: string }> = {
    connected: { icon: CheckCircle2, className: "text-emerald-600" },
    expired: { icon: Clock, className: "text-amber-600" },
    not_permitted: { icon: AlertTriangle, className: "text-amber-600" },
    not_reviewed: { icon: AlertTriangle, className: "text-amber-600" },
    not_connected: { icon: Plug, className: "text-muted-foreground" },
    secrets_missing: { icon: Unplug, className: "text-muted-foreground" },
    blocked: { icon: Unplug, className: "text-muted-foreground" },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/admin">
            <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
            {t("admin.backToDashboard")}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold">{t("social.connections.title")}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {t("social.connections.subtitle")}
        </p>

        {/* Said plainly, because the page looks like a publishing control and is
            not one: connecting an account grants nothing on its own. */}
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t("social.connections.noPublishHint")}
        </p>

        {status && (
          <Card className="mt-6">
            <CardContent className="space-y-3 p-5 text-sm">
              <div>
                <span className="font-medium">{t("social.connections.redirectUri")}</span>
                <code className="ms-2 break-all rounded bg-muted px-2 py-1 text-xs" dir="ltr">
                  {status.redirect_uri}
                </code>
              </div>
              <p className="text-muted-foreground">{t("social.connections.redirectHint")}</p>
              {!status.encryption_key_present && (
                <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t("social.connections.encryptionKeyMissing")}
                    <code className="ms-1 rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
                      SOCIAL_TOKEN_ENCRYPTION_KEY
                    </code>
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div aria-live="polite" className="sr-only">
          {loading ? t("social.connections.loading") : ""}
        </div>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only">{t("social.connections.loading")}</span>
          </div>
        ) : !status ? (
          <p className="mt-8 text-muted-foreground">{t("social.connections.loadFailed")}</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {status.providers.map((provider) => {
              const account = accountsByPlatform.get(provider.platform);
              const state = stateOf(provider, account);
              const style = STATE_STYLE[state] ?? STATE_STYLE.not_connected;
              const Icon = style.icon;
              const inputId = `handle-${provider.platform}`;
              const working = busy === provider.platform || busy === account?.account_id;

              return (
                <li key={provider.platform}>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="flex items-center gap-2 text-lg font-semibold">
                            <Icon className={`h-5 w-5 ${style.className}`} aria-hidden="true" />
                            {t(`content.platform.${provider.platform}`)}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t(`social.state.${state}.hint`)}
                          </p>
                          {account?.handle && (
                            <p className="mt-1 text-sm" dir="ltr">{account.handle}</p>
                          )}
                        </div>
                        <Badge variant={state === "connected" ? "default" : "secondary"}>
                          {t(`social.state.${state}`)}
                        </Badge>
                      </div>

                      {/* The actionable half of "not configured": which secret. */}
                      {provider.missing_secrets.length > 0 && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {t("social.connections.missingSecrets")}{" "}
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
                            {provider.missing_secrets.join(", ")}
                          </code>
                        </p>
                      )}

                      {provider.blocked_reason && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {t(errorKey(provider.blocked_reason))}
                        </p>
                      )}

                      {/* Granted, not requested. The gap between the two is the
                          whole question of whether an app review finished. */}
                      {account && account.granted_scopes.length > 0 && (
                        <p className="mt-3 break-words text-xs text-muted-foreground" dir="ltr">
                          <span className="font-medium">
                            {t("social.connections.grantedScopes")}:{" "}
                          </span>
                          {account.granted_scopes.join(", ")}
                        </p>
                      )}

                      {account?.token_expires_at && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("social.connections.expiresAt")}:{" "}
                          {new Date(account.token_expires_at).toLocaleString()}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        {!account && provider.configured && !provider.blocked_reason && (
                          <div className="min-w-[14rem] flex-1">
                            <Label htmlFor={inputId} className="text-sm">
                              {t("social.connections.handle")}
                            </Label>
                            <Input
                              id={inputId}
                              dir="ltr"
                              placeholder="@visionexworld"
                              value={handles[provider.platform] ?? ""}
                              onChange={(event) =>
                                setHandles((current) => ({
                                  ...current, [provider.platform]: event.target.value,
                                }))}
                            />
                          </div>
                        )}

                        {provider.configured && !provider.blocked_reason && (
                          <Button onClick={() => void connect(provider)} disabled={working}>
                            {working
                              ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                              : <Link2 className="me-2 h-4 w-4" aria-hidden="true" />}
                            {account
                              ? t("social.connections.reconnect")
                              : t("social.connections.connect")}
                          </Button>
                        )}

                        {account?.can_refresh && (
                          <Button
                            variant="outline"
                            onClick={() => void refresh(account)}
                            disabled={working}
                          >
                            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                            {t("social.connections.refresh")}
                          </Button>
                        )}

                        {account && account.connection !== "not_connected" && (
                          <Button
                            variant="outline"
                            onClick={() => void disconnect(account)}
                            disabled={working}
                          >
                            <Unplug className="me-2 h-4 w-4" aria-hidden="true" />
                            {t("social.connections.disconnect")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}
