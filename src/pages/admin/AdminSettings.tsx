import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: any) => { map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value); });
      setSettings(map);
    };
    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    for (const [key, value] of Object.entries(settings)) {
      const jsonValue = JSON.stringify(value);
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
      if (existing) await supabase.from("site_settings").update({ value: jsonValue }).eq("key", key);
      else await supabase.from("site_settings").insert({ key, value: jsonValue });
    }
    setLoading(false);
    toast.success(t("admin.settings.saved"));
  };

  const update = (key: string, value: string) => setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <h1 className="text-3xl font-bold">{t("admin.settings.title")}</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>{t("admin.settings.general")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>{t("admin.settings.siteName")}</Label><Input value={settings.site_name?.replace(/"/g, "") ?? ""} onChange={(e) => update("site_name", e.target.value)} /></div>
            <div><Label>{t("admin.settings.heroTitle")}</Label><Input value={settings.hero_title?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_title", e.target.value)} /></div>
            <div><Label>{t("admin.settings.heroHighlight")}</Label><Input value={settings.hero_highlight?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_highlight", e.target.value)} /></div>
            <div><Label>{t("admin.settings.heroSubtitle")}</Label><Textarea value={settings.hero_subtitle?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_subtitle", e.target.value)} /></div>
            <Button onClick={handleSave} disabled={loading} className="w-full"><Save className="me-2 h-4 w-4" />{loading ? t("admin.settings.saving") : t("admin.settings.save")}</Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("admin.settings.vxPayments")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("admin.settings.vxPaymentsDesc")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("coins.method.wishmoney")}</Label>
              <Textarea value={settings.vx_payment_wishmoney?.replace(/"/g, "") ?? ""} onChange={(e) => update("vx_payment_wishmoney", e.target.value)} placeholder={t("admin.settings.vxPaymentPlaceholder")} />
            </div>
            <div>
              <Label>{t("coins.method.omt")}</Label>
              <Textarea value={settings.vx_payment_omt?.replace(/"/g, "") ?? ""} onChange={(e) => update("vx_payment_omt", e.target.value)} placeholder={t("admin.settings.vxPaymentPlaceholder")} />
            </div>
            <div>
              <Label>{t("coins.method.paypal")}</Label>
              <Textarea value={settings.vx_payment_paypal?.replace(/"/g, "") ?? ""} onChange={(e) => update("vx_payment_paypal", e.target.value)} placeholder={t("admin.settings.vxPaymentPlaceholder")} />
            </div>
            <Button onClick={handleSave} disabled={loading} className="w-full"><Save className="me-2 h-4 w-4" />{loading ? t("admin.settings.saving") : t("admin.settings.save")}</Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
