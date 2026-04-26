import { useState } from "react";
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

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";

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
      toast.error(isAr ? "يجب الموافقة على شروط الاستخدام وسياسة الخصوصية" : "You must agree to the Terms of Use and Privacy Policy");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
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
                <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" />
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
                  {isAr ? (
                    <>
                      أوافق على{" "}
                      <Link to="/terms-of-use" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">شروط الاستخدام</Link>
                      {" "}و{" "}
                      <Link to="/privacy-policy" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">سياسة الخصوصية</Link>
                    </>
                  ) : (
                    <>
                      I agree to the{" "}
                      <Link to="/terms-of-use" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">Terms of Use</Link>
                      {" "}and{" "}
                      <Link to="/privacy-policy" target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">Privacy Policy</Link>
                    </>
                  )}
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
