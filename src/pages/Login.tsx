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
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ShoppingBag, Zap, Globe, Trophy } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.welcomeBack"));
      navigate("/dashboard");
    }
  };

  const highlights = [
    { icon: ShoppingBag, key: "home.feature.marketplace" },
    { icon: Zap,         key: "home.feature.services"    },
    { icon: Globe,       key: "home.feature.content"     },
    { icon: Trophy,      key: "leader.title"              },
  ];

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">

          {/* Brand panel — visible only on large screens */}
          <div className="hidden lg:flex flex-col gap-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                {t("home.badge")}
              </div>
              <h2 className="text-3xl font-bold leading-tight">{t("home.title")}<span className="text-primary">{t("home.titleHighlight")}</span></h2>
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

          {/* Form card */}
          <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t("auth.loginTitle")}</CardTitle>
            <CardDescription className="text-base">{t("auth.loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SocialAuthButtons />
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-base">{t("auth.email")}</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" />
              </div>
              <div>
                <Label htmlFor="password" className="text-base">{t("auth.password")}</Label>
                <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 text-base" aria-required="true" />
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-primary underline underline-offset-4">
                  {t("auth.forgotPassword") || "Forgot Password?"}
                </Link>
              </div>
              <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading}>
                {loading ? t("auth.signingIn") : t("auth.loggingIn")}
              </Button>
            </form>
            <p className="mt-2 text-center text-base text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link to="/signup" className="font-semibold text-primary underline underline-offset-4">{t("nav.signup")}</Link>
            </p>
          </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
