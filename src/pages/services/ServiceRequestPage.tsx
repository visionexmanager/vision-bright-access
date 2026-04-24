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

  const [selectedPkg, setSelectedPkg] = useState<ServicePackage | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Please log in to request a service."); return; }
    if (!selectedPkg) { toast.error("Please select a package first."); return; }
    if (!form.name || !form.email || !form.message) { toast.error("Please fill all required fields."); return; }
    if (totalPoints < selectedPkg.vx) {
      toast.error(`Insufficient VX balance. You need ${selectedPkg.vx.toLocaleString()} VX.`);
      return;
    }

    setSubmitting(true);
    try {
      // Deduct VX
      const { error: deductErr } = await supabase.from("user_points").insert({
        user_id: user.id,
        points: -selectedPkg.vx,
        activity: `Service: ${serviceType} — ${selectedPkg.name}`,
      });
      if (deductErr) throw deductErr;

      // Save request
      const { error: reqErr } = await supabase.from("service_requests").insert({
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
      toast.success("Request submitted successfully!");
    } catch {
      toast.error("Something went wrong. Please try again.");
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
          <h1 className="text-3xl font-bold mb-2">Request Submitted!</h1>
          <p className="text-muted-foreground max-w-md mb-2">
            Your request for <strong>{selectedPkg?.name}</strong> has been received.
            Our team will contact you at <strong>{form.email}</strong> within 24 hours.
          </p>
          <p className="text-sm text-primary font-semibold mb-8">
            {selectedPkg?.vx.toLocaleString()} VX has been deducted from your balance.
          </p>
          <div className="flex gap-3">
            <Link to="/services"><Button variant="outline">Back to Services</Button></Link>
            <Link to="/dashboard"><Button>View Dashboard</Button></Link>
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
            <img src={heroImage} alt="" className="h-52 w-full object-cover sm:h-64" loading="lazy" />
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
          <h2 className="mb-5 text-2xl font-bold">Choose a Package</h2>
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
                    <p className="mt-2 text-xs text-destructive font-medium">Insufficient balance</p>
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
              <h2 className="mb-1 text-xl font-bold">Submit Your Request</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {selectedPkg
                  ? `Selected: ${selectedPkg.name} — ${selectedPkg.vx.toLocaleString()} VX`
                  : "Select a package above to continue."}
              </p>

              {!user ? (
                <div className="rounded-xl border bg-muted/50 p-6 text-center">
                  <p className="mb-4 text-muted-foreground">You need to be logged in to request a service.</p>
                  <Link to="/login">
                    <Button size="lg">Log In to Continue <ArrowRight className="ms-2 h-4 w-4" /></Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Full Name *</label>
                      <Input
                        placeholder="Your full name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Email *</label>
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
                    <label className="text-sm font-medium">Phone (optional)</label>
                    <Input
                      type="tel"
                      placeholder="+1 234 567 8900"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Project Requirements *</label>
                    <Textarea
                      placeholder="Describe what you need in detail — the more specific, the better."
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
                          Your balance: {totalPoints.toLocaleString()} VX
                          {totalPoints < selectedPkg.vx && (
                            <span className="text-destructive ms-2 font-medium">
                              (need {(selectedPkg.vx - totalPoints).toLocaleString()} more)
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
                    {submitting ? "Submitting…" : `Request Service — ${selectedPkg?.vx.toLocaleString() ?? "Select package"} VX`}
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
