import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Gift, Zap, Globe, Trophy } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{name?: string; email?: string; password?: string}>({});
  const navigate = useNavigate();
  const { t } = useLanguage();
  const deviceId = useDeviceId();
  const { user, loading: authLoading } = useAuth();

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score++;
    if (password.length >= 12 && /[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score + (password.length >= 6 ? 1 : 0), 3) as 0 | 1 | 2 | 3;
  }, [password]);

  const strengthMeta = [
    { label: "", color: "" },
    { label: t("auth.passWeak") || "Weak",   color: "bg-red-500"    },
    { label: t("auth.passFair") || "Fair",   color: "bg-yellow-500" },
    { label: t("auth.passStrong") || "Strong", color: "bg-green-500"  },
  ];

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Inline field validation — visual only, no auth logic change
    const errs: typeof fieldErrors = {};
    if (!displayName.trim()) errs.name     = t("auth.nameRequired") || "Name is required";
    if (!email.trim())       errs.email    = t("auth.emailRequired") || "Email is required";
    if (password.length < 6) errs.password = t("auth.passwordTooShort") || "Min 6 characters";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    if (!agreed) {
      toast.error(t("signup.mustAgree"));
      return;
    }
    setLoading(true);

    // Device ban check (best-effort — don't block signup if RPC fails)
    if (deviceId) {
      const { data: isBanned } = await supabase.rpc("is_device_banned", { _device_id: deviceId });
      if (isBanned) {
        setLoading(false);
        toast.error(t("signup.deviceBanned"));
        return;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Record device fingerprint and enforce one-trial-per-device rule
      if (deviceId && data.user) {
        const uid = data.user.id;
        await supabase.rpc("record_device_fingerprint", {
          _device_id: deviceId,
          _user_id: uid,
          _user_agent: navigator.userAgent,
        });
      }
      toast.success(t("auth.accountCreated"));
      navigate("/dashboard");
    }
  };

  const highlights = [
    { icon: Gift,    key: "home.highlight.trial"        },
    { icon: Zap,     key: "home.highlight.allFeatures"  },
    { icon: Globe,   key: "home.feature.services"       },
    { icon: Trophy,  key: "leader.title"                },
  ];

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">

          {/* Brand panel — lg+ only */}
          <div className="hidden lg:flex flex-col gap-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                {t("home.badge")}
              </div>
              <h2 className="text-3xl font-bold leading-tight">
                {t("home.title")}<span className="text-primary">{t("home.titleHighlight")}</span>
              </h2>
              <p className="mt-3 text-muted-foreground">{t("home.subtitle")}</p>
            </div>
            <ul className="space-y-4">
              {highlights.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium">{t(key as Parameters<typeof t>[0])}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t("auth.signupTitle")}</CardTitle>
            <CardDescription className="text-base">{t("auth.signupSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SocialAuthButtons />
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-base">{t("auth.displayName")}</Label>
                <Input id="name" type="text" required value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); if (fieldErrors.name) setFieldErrors(p => ({...p, name: undefined})); }}
                  className={`mt-1 h-12 text-base ${fieldErrors.name ? "border-destructive" : ""}`}
                  aria-required="true" aria-describedby={fieldErrors.name ? "su-name-err" : undefined} />
                {fieldErrors.name && <p id="su-name-err" className="mt-1 text-xs text-destructive" role="alert">{fieldErrors.name}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="text-base">{t("auth.email")}</Label>
                <Input id="email" type="email" required autoComplete="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({...p, email: undefined})); }}
                  className={`mt-1 h-12 text-base ${fieldErrors.email ? "border-destructive" : ""}`}
                  aria-required="true" aria-describedby={fieldErrors.email ? "su-email-err" : undefined} />
                {fieldErrors.email && <p id="su-email-err" className="mt-1 text-xs text-destructive" role="alert">{fieldErrors.email}</p>}
              </div>
              <div>
                <Label htmlFor="password" className="text-base">{t("auth.password")}</Label>
                <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" aria-describedby="password-strength" />
                {password.length > 0 && (
                  <div id="password-strength" className="mt-2 space-y-1" aria-live="polite">
                    <div className="flex gap-1" role="presentation">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= passwordStrength ? strengthMeta[passwordStrength].color : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {strengthMeta[passwordStrength].label}
                    </p>
                  </div>
                )}
              </div>
              {/* Consent */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(!!v)}
                  className="mt-0.5 shrink-0"
                  aria-required="true"
                />
                <Label htmlFor="agree" className="text-sm font-normal leading-relaxed cursor-pointer">
                  {t("signup.agreePrefix")}{" "}
                  <Link to="/terms-of-use" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">{t("signup.terms")}</Link>
                  {" "}{t("signup.agreeAnd")}{" "}
                  <Link to="/privacy-policy" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">{t("signup.privacy")}</Link>
                </Label>
              </div>

              <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading || !agreed}>
                {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
              </Button>
            </form>
            <p className="mt-2 text-center text-base text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link to="/login" className="font-semibold text-primary underline underline-offset-4">{t("nav.login")}</Link>
            </p>
          </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
