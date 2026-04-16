import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check hash for type=recovery
    if (window.location.hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsMismatch") || "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.passwordTooShort") || "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.passwordUpdated") || "Password updated successfully!");
      navigate("/dashboard");
    }
  };

  if (!ready) {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center">
              <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
              <p className="text-base text-muted-foreground">
                {t("auth.verifyingLink") || "Verifying reset link..."}
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t("auth.resetPassword") || "Reset Password"}</CardTitle>
            <CardDescription className="text-base">
              {t("auth.enterNewPassword") || "Enter your new password below"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="password" className="text-base">{t("auth.newPassword") || "New Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-12 text-base"
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-base">{t("auth.confirmPassword") || "Confirm Password"}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 h-12 text-base"
                  aria-required="true"
                />
              </div>
              <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading}>
                {loading ? (t("auth.updating") || "Updating...") : (t("auth.updatePassword") || "Update Password")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
