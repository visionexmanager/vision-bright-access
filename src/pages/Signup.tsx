import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
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
              <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading}>
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
