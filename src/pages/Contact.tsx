import { useState } from "react";
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
import { Send } from "lucide-react";
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

const requestSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  serviceType: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
});

export default function Contact() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    serviceType: "",
    message: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = requestSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t("contact.error"), variant: "destructive" });
      return;
    }

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
    setForm({ fullName: "", email: "", phone: "", serviceType: "", message: "" });
  };

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby="contact-heading">
        <h1 id="contact-heading" className="mb-2 text-3xl font-bold">
          {t("contact.title")}
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("contact.subtitle")}</p>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName" className="text-base font-semibold">
                  {t("contact.fullName")}
                </Label>
                <Input
                  id="fullName"
                  required
                  maxLength={100}
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  className="text-base"
                />
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
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone" className="text-base font-semibold">
                  {t("contact.phone")}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  maxLength={30}
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="message" className="text-base font-semibold">
                  {t("contact.message")}
                </Label>
                <Textarea
                  id="message"
                  required
                  maxLength={2000}
                  rows={5}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  className="text-base"
                />
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
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
