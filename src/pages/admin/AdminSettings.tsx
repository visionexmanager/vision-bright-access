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

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: any) => {
        map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
      });
      setSettings(map);
    };
    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    for (const [key, value] of Object.entries(settings)) {
      const jsonValue = JSON.stringify(value);
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ value: jsonValue }).eq("key", key);
      } else {
        await supabase.from("site_settings").insert({ key, value: jsonValue });
      }
    }
    setLoading(false);
    toast.success("Settings saved");
  };

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Layout>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">Site Settings</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Site Name</Label>
              <Input value={settings.site_name?.replace(/"/g, "") ?? ""} onChange={(e) => update("site_name", e.target.value)} />
            </div>
            <div>
              <Label>Hero Title</Label>
              <Input value={settings.hero_title?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_title", e.target.value)} />
            </div>
            <div>
              <Label>Hero Highlight Word</Label>
              <Input value={settings.hero_highlight?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_highlight", e.target.value)} />
            </div>
            <div>
              <Label>Hero Subtitle</Label>
              <Textarea value={settings.hero_subtitle?.replace(/"/g, "") ?? ""} onChange={(e) => update("hero_subtitle", e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={loading} className="w-full">
              <Save className="me-2 h-4 w-4" />
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
