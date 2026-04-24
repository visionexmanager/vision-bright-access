import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, Mail, Users, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const TOPICS = [
  { value: "all", label: "كل المشتركين" },
  { value: "products", label: "المنتجات" },
  { value: "services", label: "الخدمات" },
  { value: "courses", label: "الكورسات" },
  { value: "games", label: "الألعاب" },
  { value: "tech-news", label: "أخبار التقنية" },
  { value: "global-news", label: "أخبار عالمية" },
];

const EMAIL_TEMPLATES = [
  {
    name: "ترحيب بمستخدم جديد",
    subject: "مرحباً بك في Visionex!",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
<h1 style="color:#6d28d9">مرحباً بك في Visionex! 🎉</h1>
<p>نسعد بانضمامك إلى مجتمعنا. Visionex هي منصتك الشاملة للوصولية والتكنولوجيا المساعدة.</p>
<p>يمكنك الآن:</p>
<ul><li>تصفح المنتجات المساعدة</li><li>الوصول إلى محتوى تعليمي متميز</li><li>التواصل مع مجتمع الوصولية</li></ul>
<a href="https://visionex.app" style="background:#6d28d9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">ابدأ الاستكشاف</a>
<p style="color:#666;margin-top:24px;font-size:12px">فريق Visionex</p>
</div>`,
  },
  {
    name: "نشرة أخبار المنتجات",
    subject: "منتجات جديدة في Visionex 🛒",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
<h1 style="color:#6d28d9">منتجات جديدة وصلت!</h1>
<p>اكتشف أحدث المنتجات المساعدة المتاحة على منصة Visionex.</p>
<a href="https://visionex.app/assistive-products" style="background:#6d28d9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">تصفح المنتجات</a>
<p style="color:#666;margin-top:24px;font-size:12px">لإلغاء الاشتراك في النشرة، تواصل معنا عبر البريد الإلكتروني.</p>
</div>`,
  },
  {
    name: "إشعار مخصص",
    subject: "",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
<h1 style="color:#6d28d9"></h1>
<p></p>
<p style="color:#666;margin-top:24px;font-size:12px">فريق Visionex</p>
</div>`,
  },
];

export default function AdminEmails() {
  const [tab, setTab] = useState("newsletter");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [topic, setTopic] = useState("all");
  const [singleEmail, setSingleEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const applyTemplate = (name: string) => {
    const t = EMAIL_TEMPLATES.find(t => t.name === name);
    if (t) { setSubject(t.subject); setHtml(t.html); setSelectedTemplate(name); }
  };

  const sendEmail = async () => {
    if (!subject || !html) { toast.error("العنوان والمحتوى مطلوبان"); return; }
    if (tab === "single" && !singleEmail) { toast.error("البريد الإلكتروني مطلوب"); return; }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          type: tab === "newsletter" ? "newsletter" : "single",
          subject,
          html,
          to: tab === "single" ? [singleEmail] : undefined,
          topic: tab === "newsletter" ? topic : undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "فشل الإرسال");
      toast.success(`تم إرسال ${result.sent} إيميل بنجاح`);
      if (result.failed > 0) toast.warning(`فشل إرسال ${result.failed} إيميل`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">إدارة الإيميلات</h1>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          لإرسال الإيميلات، تأكد من إضافة <code className="mx-1 rounded bg-yellow-100 px-1 dark:bg-yellow-900">RESEND_API_KEY</code> في Supabase Secrets.
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">القوالب الجاهزة</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {EMAIL_TEMPLATES.map(t => (
                  <Button key={t.name} variant={selectedTemplate === t.name ? "default" : "outline"}
                    className="w-full justify-start text-sm" onClick={() => applyTemplate(t.name)}>
                    <Mail className="me-2 h-4 w-4" />{t.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="newsletter" className="flex-1">
                  <Users className="me-2 h-4 w-4" /> نشرة بريدية
                </TabsTrigger>
                <TabsTrigger value="single" className="flex-1">
                  <Mail className="me-2 h-4 w-4" /> إيميل مفرد
                </TabsTrigger>
              </TabsList>

              <TabsContent value="newsletter" className="space-y-4">
                <div>
                  <Label>الموضوع (فئة المشتركين)</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TOPICS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="single" className="space-y-4">
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" value={singleEmail} onChange={e => setSingleEmail(e.target.value)} placeholder="example@email.com" />
                </div>
              </TabsContent>
            </Tabs>

            <div>
              <Label>عنوان الإيميل</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="عنوان الإيميل..." />
            </div>

            <div>
              <Label>محتوى HTML</Label>
              <Textarea
                value={html}
                onChange={e => setHtml(e.target.value)}
                placeholder="<div>محتوى الإيميل بصيغة HTML...</div>"
                className="font-mono text-sm min-h-[200px]"
              />
            </div>

            {html && (
              <Card>
                <CardHeader><CardTitle className="text-sm">معاينة</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded border p-4 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
                </CardContent>
              </Card>
            )}

            <Button onClick={sendEmail} disabled={sending} className="w-full" size="lg">
              <Send className="me-2 h-4 w-4" />
              {sending ? "جاري الإرسال..." : "إرسال الإيميل"}
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
