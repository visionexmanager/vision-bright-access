import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Mail, Clock, MessageSquare, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const serviceTypes = [
  "contact.sWebDesign",
  "contact.sMarketing",
  "contact.sImport",
  "contact.sConsulting",
  "contact.sTraining",
  "contact.sCustomProduct",
  "contact.sOther",
] as const;

const MESSAGE_MAX = 2000;

const requestSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  serviceType: z.string().min(1),
  message: z.string().trim().min(1).max(MESSAGE_MAX),
});

export default function ContactUs() {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    serviceType: "",
    message: "",
  });

  // Prefill email for logged-in users (only while the field is still empty)
  useEffect(() => {
    if (user?.email) {
      setForm((prev) => (prev.email ? prev : { ...prev, email: user.email! }));
    }
  }, [user?.email]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = requestSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        if (e.path[0]) errs[String(e.path[0])] = e.message;
      });
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    const { error } = await supabase.functions.invoke("contact-form", {
      body: {
        user_id: user?.id ?? null,
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        service_type: t(parsed.data.serviceType),
        message: parsed.data.message,
      },
    });

    setLoading(false);

    if (error) {
      toast({ title: t("contact.error"), variant: "destructive" });
      return;
    }

    toast({
      title: t("contact.success"),
      description: t("contact.successDesc"),
    });
    setForm({ fullName: "", email: user?.email ?? "", phone: "", serviceType: "", message: "" });
    setSubmitted(true);
  };

  const infoCards = (
    <>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs text-muted-foreground">{t("contact.emailUs")}</p>
          <a href="mailto:hello@visionex.app" className="text-sm font-semibold text-primary hover:underline">
            hello@visionex.app
          </a>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs text-muted-foreground">{t("contact.responseLabel")}</p>
          <p className="text-sm font-semibold">{t("contact.responseTime")}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <MessageSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs text-muted-foreground">{t("contact.supportLabel")}</p>
          <p className="text-sm font-semibold">{t("contact.supportHours")}</p>
        </div>
      </div>
    </>
  );

  return (
    <Layout>
      <section className="section-container py-12" aria-labelledby="contact-heading" dir={dir}>
        <h1 id="contact-heading" className="mb-2 text-3xl font-bold">
          {t("contact.title")}
        </h1>
        <p className="mb-6 text-lg text-muted-foreground">{t("contact.subtitle")}</p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {/* Form */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              {submitted ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
                  <CheckCircle2 className="h-12 w-12 text-green-500" aria-hidden="true" />
                  <div>
                    <h2 className="text-xl font-bold">{t("contact.success")}</h2>
                    <p className="mt-1 text-muted-foreground">{t("contact.successDesc")}</p>
                  </div>
                  <Button variant="outline" onClick={() => setSubmitted(false)}>
                    {t("contact.sendAnother")}
                  </Button>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fullName" className="text-base font-semibold">
                      {t("contact.fullName")}
                    </Label>
                    <Input
                      id="fullName"
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => { set("fullName", e.target.value); if (fieldErrors.fullName) setFieldErrors(p => ({...p, fullName: ""})); }}
                      className={`text-base ${fieldErrors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
                    />
                    {fieldErrors.fullName && <p id="fullName-error" className="mt-1 text-xs text-destructive" role="alert">{fieldErrors.fullName}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-base font-semibold">
                      {t("contact.email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      maxLength={255}
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => { set("email", e.target.value); if (fieldErrors.email) setFieldErrors(p => ({...p, email: ""})); }}
                      className={`text-base ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    />
                    {fieldErrors.email && <p id="email-error" className="mt-1 text-xs text-destructive" role="alert">{fieldErrors.email}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone" className="text-base font-semibold">
                      {t("contact.phone")}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      maxLength={30}
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      className="text-base"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="serviceType" className="text-base font-semibold">
                      {t("contact.serviceType")}
                    </Label>
                    <Select
                      value={form.serviceType}
                      onValueChange={(v) => set("serviceType", v)}
                      required
                    >
                      <SelectTrigger id="serviceType" className="text-base">
                        <SelectValue placeholder={t("contact.selectService")} />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((key) => (
                          <SelectItem key={key} value={key} className="text-base">
                            {t(key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="message" className="text-base font-semibold">
                      {t("contact.message")}
                    </Label>
                    <span className="text-xs text-muted-foreground" aria-hidden="true">
                      {form.message.length}/{MESSAGE_MAX}
                    </span>
                  </div>
                  <Textarea
                    id="message"
                    required
                    maxLength={MESSAGE_MAX}
                    rows={5}
                    value={form.message}
                    onChange={(e) => { set("message", e.target.value); if (fieldErrors.message) setFieldErrors(p => ({...p, message: ""})); }}
                    className={`text-base ${fieldErrors.message ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-describedby={fieldErrors.message ? "message-error" : undefined}
                  />
                  {fieldErrors.message && <p id="message-error" className="mt-1 text-xs text-destructive" role="alert">{fieldErrors.message}</p>}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full text-base font-semibold"
                >
                  <Send className="me-2 h-5 w-5" aria-hidden="true" />
                  {loading ? t("contact.sending") : t("contact.submit")}
                </Button>
              </form>
              )}
            </CardContent>
          </Card>

          {/* Contact info — side column on desktop, stacked below form on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {infoCards}
          </div>
        </div>
      </section>
    </Layout>
  );
}
