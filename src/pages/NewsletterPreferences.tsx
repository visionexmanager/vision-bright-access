import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, Loader2, Mail, Save, Trash2 } from "lucide-react";

const TOPICS = [
  ["news-technology", "news.cat.technology", "💻"],
  ["news-ai", "news.cat.ai", "🤖"],
  ["news-marketplace", "news.cat.marketplace", "🛒"],
  ["news-games", "news.cat.games", "🎮"],
  ["news-academy", "news.cat.academy", "🎓"],
  ["news-health", "news.cat.health", "🏥"],
  ["news-legal", "news.cat.legal", "⚖️"],
  ["news-business", "news.cat.business", "📈"],
  ["news-travel", "news.cat.travel", "✈️"],
  ["news-beauty", "news.cat.beauty", "✨"],
  ["news-sports", "news.cat.sports", "🏆"],
  ["news-music", "news.cat.music", "🎵"],
  ["news-psychology", "news.cat.psychology", "🧠"],
  ["news-community", "news.cat.community", "🌐"],
  ["news-accessibility", "news.cat.accessibility", "♿"],
  ["news-entertainment", "news.cat.entertainment", "📺"],
  ["news-nutrition", "news.cat.nutrition", "🥗"],
  ["news-platform", "news.cat.platform", "🚀"],
  ["news-world-economy", "news.cat.world_economy", "💵"],
  ["news-world-politics", "news.cat.world_politics", "🏛️"],
] as const;

const LANGUAGES: Record<string, string> = {
  en: "English", ar: "العربية", es: "Español", de: "Deutsch", pt: "Português",
  zh: "中文", tr: "Türkçe", fr: "Français", ru: "Русский", ur: "اردو", hi: "हिन्दी",
};

type Subscriber = { email: string; name: string | null; topics: string[]; lang: string };

export default function NewsletterPreferences() {
  const { t, lang: interfaceLang } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const wantsUnsubscribe = params.get("action") === "unsubscribe";
  const ar = interfaceLang === "ar";
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unsubscribed, setUnsubscribed] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("newsletter-preferences", {
      body: { ...body, token },
    });
    if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "Request failed");
    return data;
  };

  useEffect(() => {
    let active = true;
    call({ action: "get" })
      .then((data) => {
        if (!active) return;
        const value = data.subscriber as Subscriber;
        setSubscriber(value);
        setTopics(value.topics);
        setLanguage(value.lang || "en");
      })
      .catch(() => active && setError(ar ? "رابط الإدارة غير صالح أو منتهي." : "This management link is invalid or expired."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  const toggle = (topic: string) => {
    setTopics((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await call({ action: "update", topics, lang: language });
      setMessage(ar ? "تم حفظ اهتمامات البريد بنجاح." : "Your email preferences were saved.");
    } catch {
      setError(ar ? "تعذر حفظ التغييرات. حاول مجدداً." : "Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const unsubscribe = async () => {
    setSaving(true);
    setError("");
    try {
      await call({ action: "unsubscribe" });
      setUnsubscribed(true);
      setSubscriber(null);
    } catch {
      setError(ar ? "تعذر إلغاء الاشتراك. حاول مجدداً." : "Could not unsubscribe. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <section className="section-container max-w-4xl py-12">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <Mail className="mx-auto mb-2 h-10 w-10 text-primary" aria-hidden="true" />
            <CardTitle>{ar ? "إدارة اشتراك البريد" : "Manage email subscription"}</CardTitle>
            <CardDescription>
              {ar ? "اختر الأخبار التي تهمك ولغة الرسائل، أو ألغِ الاشتراك." : "Choose the news you want, your email language, or unsubscribe."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {error && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
            {unsubscribed && (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
                <h2 className="text-xl font-bold">{ar ? "تم إلغاء اشتراكك" : "You are unsubscribed"}</h2>
                <p className="mt-2 text-muted-foreground">{ar ? "لن تصلك رسائل إخبارية أخرى." : "You will no longer receive newsletter emails."}</p>
              </div>
            )}
            {subscriber && !unsubscribed && (
              <div className="space-y-7">
                <p className="text-center text-sm text-muted-foreground">{subscriber.email}</p>
                {wantsUnsubscribe ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                    <h2 className="font-bold">{ar ? "هل تريد إلغاء الاشتراك؟" : "Unsubscribe from all emails?"}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{ar ? "يمكنك بدلاً من ذلك تعديل الأقسام التي تصلك أدناه." : "You can also keep your subscription and change the topics below."}</p>
                    <Button variant="destructive" className="mt-5" onClick={unsubscribe} disabled={saving}>
                      <Trash2 className="me-2 h-4 w-4" />{ar ? "تأكيد إلغاء الاشتراك" : "Confirm unsubscribe"}
                    </Button>
                  </div>
                ) : null}

                <div>
                  <Label className="mb-2 block">{ar ? "لغة الرسائل" : "Email language"}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(LANGUAGES).map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-3 block">{ar ? "أقسام الأخبار" : "News interests"}</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {TOPICS.map(([key, labelKey, emoji]) => (
                      <Label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${topics.includes(key) ? "border-primary bg-primary/10" : "border-border"}`}>
                        <Checkbox checked={topics.includes(key)} onCheckedChange={() => toggle(key)} />
                        <span>{emoji}</span><span className="text-sm">{t(labelKey)}</span>
                      </Label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{ar ? "إذا لم تختر أي قسم، ستصلك النشرة العامة." : "With no topics selected, you receive the general digest."}</p>
                </div>

                {message && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">{message}</p>}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="flex-1" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                    {ar ? "حفظ التغييرات" : "Save changes"}
                  </Button>
                  {!wantsUnsubscribe && <Button variant="outline" className="text-destructive" onClick={unsubscribe} disabled={saving}><Trash2 className="me-2 h-4 w-4" />{ar ? "إلغاء الاشتراك" : "Unsubscribe"}</Button>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}

