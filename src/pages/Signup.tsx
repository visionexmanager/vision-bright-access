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

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (password.length < 6) {
      toast.error(t("auth.passwordTooShort") || "Password must be at least 6 characters");
      return;
    }
    if (!displayName.trim()) {
      toast.error(t("auth.nameRequired"));
      return;
    }
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

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t("auth.signupTitle")}</CardTitle>
            <CardDescription className="text-base">{t("auth.signupSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SocialAuthButtons />
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-base">{t("auth.displayName")}</Label>
                <Input id="name" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" />
              </div>
              <div>
                <Label htmlFor="email" className="text-base">{t("auth.email")}</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" />
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
    </Layout>
  );
}
