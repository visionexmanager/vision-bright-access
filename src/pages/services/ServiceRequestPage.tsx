import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSound } from "@/contexts/SoundContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, Coins, ArrowRight, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export interface ServicePackage {
  name: string;
  vx: number;
  description: string;
  features: string[];
  badge?: string;
}

interface Props {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  heroImage: string;
  serviceType: string;
  packages: ServicePackage[];
  highlights: { icon: LucideIcon; label: string; value: string }[];
}

export default function ServiceRequestPage({
  title, subtitle, icon: Icon, heroImage, serviceType, packages, highlights,
}: Props) {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const queryClient = useQueryClient();
  const { playSound } = useSound();
  const { t } = useLanguage();

  const [selectedPkg, setSelectedPkg] = useState<ServicePackage | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error(t("svcReq.errLogin")); return; }
    if (!selectedPkg) { toast.error(t("svcReq.errSelectPkg")); return; }
    if (!form.name || !form.email || !form.message) { toast.error(t("svcReq.errFillFields")); return; }
    if (totalPoints < selectedPkg.vx) {
      toast.error(t("svcReq.errInsufficientVX").replace("{vx}", selectedPkg.vx.toLocaleString()));
      return;
    }

    setSubmitting(true);
    try {
      const { error: deductErr } = await supabase.from("user_points").insert({
        user_id: user.id,
        points: -selectedPkg.vx,
        reason: `Service: ${serviceType} — ${selectedPkg.name}`,
      });
      if (deductErr) throw deductErr;

      const { error: reqErr } = await supabase.from("service_requests").insert({
        user_id: user.id,
        full_name: form.name,
        email: form.email,
        phone: form.phone || null,
        service_type: `${serviceType} — ${selectedPkg.name}`,
        message: form.message,
        status: "pending",
      });
      if (reqErr) throw reqErr;

      queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
      playSound("success");
      setSubmitted(true);
      toast.success(t("svcReq.successToast"));
    } catch {
      toast.error(t("svcReq.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t("svcReq.successTitle")}</h1>
          <p className="text-muted-foreground max-w-md mb-2">
            {t("svcReq.successDesc")
              .replace("{name}", selectedPkg?.name ?? "")
              .replace("{email}", form.email)}
          </p>
          <p className="text-sm text-primary font-semibold mb-8">
            {t("svcReq.vxDeducted").replace("{vx}", (selectedPkg?.vx ?? 0).toLocaleString())}
          </p>
          <div className="flex gap-3">
            <Link to="/services"><Button variant="outline">{t("svcReq.backToServices")}</Button></Link>
            <Link to="/dashboard"><Button>{t("svcReq.viewDashboard")}</Button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10">
        {/* Hero */}
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={heroImage} alt="" role="presentation" className="h-52 w-full object-cover sm:h-64" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 mb-3">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Highlights */}
        <AnimatedSection>
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {highlights.map(({ icon: HIcon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <HIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Packages */}
        <AnimatedSection>
          <h2 className="mb-5 text-2xl font-bold">{t("svcReq.choosePackage")}</h2>
        </AnimatedSection>
        <StaggerGrid className="mb-10 grid gap-5 sm:grid-cols-3">
          {packages.map((pkg) => {
            const selected = selectedPkg?.name === pkg.name;
            const affordable = totalPoints >= pkg.vx;
            return (
              <StaggerItem key={pkg.name}>
                <button
                  type="button"
                  onClick={() => setSelectedPkg(pkg)}
                  className={`w-full text-left rounded-2xl border-2 p-5 transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{pkg.name}</p>
                      {pkg.badge && (
                        <Badge className="mt-1 text-xs">{pkg.badge}</Badge>
                      )}
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
                  <ul className="space-y-1.5 mb-4">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className={`flex items-center gap-1.5 font-bold text-lg ${affordable ? "text-primary" : "text-muted-foreground"}`}>
                    <Coins className="h-5 w-5" />
                    {pkg.vx.toLocaleString()} VX
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ≈ ${(pkg.vx / 1000).toLocaleString()} USD
                  </p>
                  {user && !affordable && (
                    <p className="mt-2 text-xs text-destructive font-medium">{t("svcReq.insufficientBalance")}</p>
                  )}
                </button>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        {/* Request Form */}
        <AnimatedSection>
          <Card className="shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h2 className="mb-1 text-xl font-bold">{t("svcReq.submitRequest")}</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {selectedPkg
                  ? t("svcReq.selectedPkg").replace("{name}", selectedPkg.name).replace("{vx}", selectedPkg.vx.toLocaleString())
                  : t("svcReq.selectPackagePrompt")}
              </p>

              {!user ? (
                <div className="rounded-xl border bg-muted/50 p-6 text-center">
                  <p className="mb-4 text-muted-foreground">{t("svcReq.loginPrompt")}</p>
                  <Link to="/login">
                    <Button size="lg">{t("svcReq.loginBtn")} <ArrowRight className="ms-2 h-4 w-4" /></Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t("svcReq.fullName")}</label>
                      <Input
                        placeholder={t("svcReq.fullNamePlaceholder")}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t("svcReq.email")}</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("svcReq.phone")}</label>
                    <Input
                      type="tel"
                      placeholder="+1 234 567 8900"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("svcReq.requirements")}</label>
                    <Textarea
                      placeholder={t("svcReq.requirementsPlaceholder")}
                      className="min-h-[120px]"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      required
                    />
                  </div>

                  {selectedPkg && user && (
                    <div className="rounded-xl border bg-primary/5 p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{selectedPkg.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("svcReq.balance").replace("{vx}", totalPoints.toLocaleString())}
                          {totalPoints < selectedPkg.vx && (
                            <span className="text-destructive ms-2 font-medium">
                              {t("svcReq.needMore").replace("{amount}", (selectedPkg.vx - totalPoints).toLocaleString())}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xl font-bold text-primary">
                        <Coins className="h-5 w-5" />
                        {selectedPkg.vx.toLocaleString()} VX
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-base font-semibold"
                    disabled={submitting || !selectedPkg || (!!selectedPkg && totalPoints < selectedPkg.vx)}
                  >
                    {submitting
                      ? t("svcReq.submitting")
                      : t("svcReq.requestBtn").replace("{vx}", selectedPkg?.vx.toLocaleString() ?? t("svcReq.selectPkgPlaceholder"))}
                    {!submitting && <ArrowRight className="ms-2 h-5 w-5" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </section>
    </Layout>
  );
}
