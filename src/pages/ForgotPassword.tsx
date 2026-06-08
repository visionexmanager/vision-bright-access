import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success(t("auth.resetEmailSent") || "Password reset email sent!");
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t("auth.forgotPassword") || "Forgot Password"}</CardTitle>
            <CardDescription className="text-base">
              {t("auth.forgotPasswordDesc") || "Enter your email and we'll send you a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <p className="text-base text-muted-foreground">
                  {t("auth.checkInbox") || "Check your inbox for a password reset link."}
                </p>
                <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                  {t("auth.tryAgain") || "Send again"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-base">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-12 text-base"
                    aria-required="true"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading}>
                  {loading ? (t("auth.sending") || "Sending...") : (t("auth.sendResetLink") || "Send Reset Link")}
                </Button>
              </form>
            )}
            <p className="mt-2 text-center text-base text-muted-foreground">
              <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4">
                <ArrowLeft className="h-4 w-4" />
                {t("auth.backToLogin") || "Back to Login"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
