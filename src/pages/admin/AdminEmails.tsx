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

const SENDERS = [
  { value: "hello",   label: "hello@visionex.app",    desc: "التواصل العام" },
  { value: "news",    label: "news@visionex.app",     desc: "النشرة البريدية" },
  { value: "legal",   label: "legal@visionex.app",    desc: "الشؤون القانونية" },
  { value: "support", label: "support@visionex.app",  desc: "الدعم الفني" },
  { value: "noreply", label: "no-reply@visionex.app", desc: "إيميلات تلقائية" },
];

const TOPICS = [
  { value: "all", label: "كل المشتركين" },
  { value: "products", label: "المنتجات" },
  { value: "services", label: "الخدمات" },
  { value: "courses", label: "الكورسات" },
  { value: "games", label: "الألعاب" },
  { value: "tech-news", label: "أخبار التقنية" },
  { value: "global-news", label: "أخبار عالمية" },
];

const BASE = `font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:0;background:#ffffff`;
const HDR  = `background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0`;
const BOD  = `padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px`;
const BTN  = `background:#6d28d9;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;margin-top:20px`;
const FOT  = `margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;text-align:center`;

const EMAIL_TEMPLATES = [
  // ── 1. VX منحة ──────────────────────────────────────────────────────────
  {
    name: "🪙 منحة VX للمستخدم",
    subject: "🎁 تم إضافة [XXX] عملة VX إلى رصيدك!",
    sender: "hello",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <div style="font-size:48px">🪙</div>
    <h1 style="color:#fff;margin:12px 0 4px;font-size:24px">تم إضافة عملات VX!</h1>
    <p style="color:#c4b5fd;margin:0;font-size:14px">مكافأة خاصة من Visionex</p>
  </div>
  <div style="${BOD}">
    <p style="font-size:16px;color:#374151">أهلاً،</p>
    <p style="color:#4b5563;line-height:1.7">
      يسعدنا إعلامك بأنه تم إضافة
      <span style="color:#6d28d9;font-weight:bold;font-size:20px"> [XXX] عملة VX </span>
      إلى رصيدك على منصة Visionex.
    </p>
    <div style="background:#f5f3ff;border-radius:10px;padding:16px 20px;margin:20px 0;border-right:4px solid #6d28d9">
      <p style="margin:0;color:#5b21b6;font-size:14px">💡 <strong>ماذا تفعل بعملات VX؟</strong></p>
      <ul style="color:#6b7280;font-size:13px;margin:8px 0 0;padding-right:16px;line-height:1.8">
        <li>شراء أدوات احترافية</li>
        <li>فتح متجر في VXBazaar</li>
        <li>الوصول لمحتوى حصري</li>
      </ul>
    </div>
    <p style="color:#4b5563;font-size:14px">[سبب المنحة — اكتب هنا]</p>
    <a href="https://visionex.app/coins-store" style="${BTN}">عرض رصيدي</a>
    <div style="${FOT}">
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 2. النشرة الأولى ─────────────────────────────────────────────────────
  {
    name: "📬 النشرة الأولى — الإطلاق",
    subject: "🚀 Visionex انطلقت — إليك ما ينتظرك!",
    sender: "news",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <div style="font-size:48px">🚀</div>
    <h1 style="color:#fff;margin:12px 0 4px;font-size:24px">مرحباً بك في Visionex!</h1>
    <p style="color:#c4b5fd;margin:0;font-size:14px">النشرة البريدية الرسمية — العدد الأول</p>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">
      سعداء بانضمامك إلى مجتمع Visionex — المنصة المبنية للجميع، بمعايير وصولية عالية.
    </p>

    <h2 style="color:#6d28d9;font-size:16px;margin-top:24px">✨ ما يمكنك فعله الآن</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:10px;background:#f9fafb;border-radius:8px;margin-bottom:8px">
          🛍️ <strong>VXBazaar</strong> — سوق رقمي لفتح متجرك وبيع منتجاتك
        </td>
      </tr>
      <tr><td style="padding:4px"></td></tr>
      <tr>
        <td style="padding:10px;background:#f9fafb;border-radius:8px">
          🤖 <strong>خدمات AI</strong> — مساعد ذكي، تحليل صور، خبير تغذية والمزيد
        </td>
      </tr>
      <tr><td style="padding:4px"></td></tr>
      <tr>
        <td style="padding:10px;background:#f9fafb;border-radius:8px">
          🎮 <strong>ألعاب وتحديات</strong> — العب واربح عملات VX
        </td>
      </tr>
      <tr><td style="padding:4px"></td></tr>
      <tr>
        <td style="padding:10px;background:#f9fafb;border-radius:8px">
          📚 <strong>الأكاديمية</strong> — كورسات ومحاكاة تدريبية
        </td>
      </tr>
    </table>

    <a href="https://visionex.app" style="${BTN}">اكتشف المنصة</a>

    <div style="${FOT}">
      <p>وصلك هذا الإيميل لاشتراكك في النشرة البريدية لـ Visionex.</p>
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 3. نشرة أخبار دورية ──────────────────────────────────────────────────
  {
    name: "📰 نشرة أخبار دورية",
    subject: "📰 أخبار Visionex — [الشهر واالسنة]",
    sender: "news",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <p style="color:#c4b5fd;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:2px">النشرة الدورية</p>
    <h1 style="color:#fff;margin:0;font-size:22px">أخبار Visionex</h1>
    <p style="color:#c4b5fd;margin:8px 0 0;font-size:13px">[الشهر واالسنة]</p>
  </div>
  <div style="${BOD}">

    <h2 style="color:#6d28d9;font-size:15px;border-bottom:2px solid #ede9fe;padding-bottom:8px">🆕 الجديد هذا الشهر</h2>
    <p style="color:#4b5563;line-height:1.7">[اكتب هنا أبرز التحديثات والميزات الجديدة]</p>

    <h2 style="color:#6d28d9;font-size:15px;border-bottom:2px solid #ede9fe;padding-bottom:8px;margin-top:24px">📊 أرقام المجتمع</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;background:#f5f3ff;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:bold;color:#6d28d9">[XXX]</div>
        <div style="font-size:12px;color:#6b7280">مستخدم نشط</div>
      </div>
      <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:bold;color:#16a34a">[XXX]</div>
        <div style="font-size:12px;color:#6b7280">متجر في VXBazaar</div>
      </div>
      <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:bold;color:#ea580c">[XXX]</div>
        <div style="font-size:12px;color:#6b7280">مليون VX موزّعة</div>
      </div>
    </div>

    <h2 style="color:#6d28d9;font-size:15px;border-bottom:2px solid #ede9fe;padding-bottom:8px;margin-top:24px">💡 نصيحة الشهر</h2>
    <p style="color:#4b5563;line-height:1.7">[اكتب نصيحة أو ميزة مخفية تريد إبرازها]</p>

    <a href="https://visionex.app" style="${BTN}">زيارة المنصة</a>

    <div style="${FOT}">
      <p>وصلك هذا الإيميل لاشتراكك في النشرة البريدية لـ Visionex.</p>
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 4. إطلاق ميزة جديدة ─────────────────────────────────────────────────
  {
    name: "✨ إطلاق ميزة جديدة",
    subject: "✨ ميزة جديدة في Visionex — [اسم الميزة]",
    sender: "hello",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <div style="font-size:48px">✨</div>
    <h1 style="color:#fff;margin:12px 0 4px;font-size:24px">[اسم الميزة]</h1>
    <p style="color:#c4b5fd;margin:0;font-size:14px">أحدث إضافة لمنصة Visionex</p>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">
      يسعدنا الإعلان عن إطلاق <strong>[اسم الميزة]</strong> — [وصف مختصر جداً في جملة].
    </p>

    <div style="background:#f5f3ff;border-radius:12px;padding:20px;margin:20px 0">
      <h3 style="color:#5b21b6;margin:0 0 12px;font-size:15px">ماذا تقدم هذه الميزة؟</h3>
      <ul style="color:#6b7280;font-size:14px;margin:0;padding-right:16px;line-height:2">
        <li>[فائدة ١]</li>
        <li>[فائدة ٢]</li>
        <li>[فائدة ٣]</li>
      </ul>
    </div>

    <a href="https://visionex.app/[رابط-الميزة]" style="${BTN}">جرّبها الآن</a>

    <div style="${FOT}">
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 5. عرض خاص / مكافأة ─────────────────────────────────────────────────
  {
    name: "🎉 عرض خاص أو مكافأة",
    subject: "🎉 عرض حصري لك من Visionex!",
    sender: "hello",
    html: `<div dir="rtl" style="${BASE}">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
    <div style="font-size:48px">🎁</div>
    <h1 style="color:#fff;margin:12px 0 4px;font-size:24px">عرض حصري لك!</h1>
    <p style="color:#fef3c7;margin:0;font-size:14px">لفترة محدودة</p>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">أهلاً،</p>
    <p style="color:#4b5563;line-height:1.7">
      [وصف العرض أو المكافأة — مثلاً: احصل على XXX عملة VX مجاناً عند إتمام أول عملية شراء هذا الأسبوع]
    </p>

    <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:10px;padding:16px;text-align:center;margin:20px 0">
      <p style="margin:0;color:#92400e;font-size:13px">ينتهي العرض في</p>
      <p style="margin:6px 0 0;color:#b45309;font-weight:bold;font-size:18px">[التاريخ]</p>
    </div>

    <a href="https://visionex.app" style="background:#f59e0b;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;margin-top:4px">استفد من العرض</a>

    <div style="${FOT}">
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 6. دعوة للعودة ──────────────────────────────────────────────────────
  {
    name: "💌 دعوة للعودة",
    subject: "💌 نفتقدك في Visionex!",
    sender: "hello",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <div style="font-size:48px">💌</div>
    <h1 style="color:#fff;margin:12px 0 4px;font-size:24px">نفتقدك!</h1>
    <p style="color:#c4b5fd;margin:0;font-size:14px">لم نرك منذ فترة</p>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">أهلاً،</p>
    <p style="color:#4b5563;line-height:1.7">
      لاحظنا أنك لم تزر Visionex مؤخراً — لا بأس! نحن هنا دائماً، وعندنا جديد ينتظرك:
    </p>

    <ul style="color:#4b5563;font-size:14px;line-height:2;padding-right:16px">
      <li>🆕 [جديد ١ — مثلاً: ميزات جديدة في VXBazaar]</li>
      <li>🎮 [جديد ٢ — مثلاً: ألعاب ومسابقات جديدة]</li>
      <li>🪙 [جديد ٣ — مثلاً: طرق جديدة لكسب VX]</li>
    </ul>

    <a href="https://visionex.app" style="${BTN}">عودة للمنصة</a>

    <div style="${FOT}">
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 7. تحديث مهم / صيانة ────────────────────────────────────────────────
  {
    name: "⚙️ إشعار تحديث أو صيانة",
    subject: "⚙️ تحديث مهم على منصة Visionex",
    sender: "noreply",
    html: `<div dir="rtl" style="${BASE}">
  <div style="background:#1e293b;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
    <div style="font-size:48px">⚙️</div>
    <h1 style="color:#f1f5f9;margin:12px 0 4px;font-size:22px">إشعار تحديث</h1>
    <p style="color:#94a3b8;margin:0;font-size:14px">معلومة مهمة من فريق Visionex</p>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">
      نودّ إعلامك بأننا سنجري <strong>[تحديثاً / صيانة مجدولة]</strong> على المنصة.
    </p>

    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin:16px 0;border-right:4px solid #64748b">
      <p style="margin:0 0 8px;color:#475569;font-size:14px"><strong>📅 الموعد:</strong> [التاريخ والوقت]</p>
      <p style="margin:0 0 8px;color:#475569;font-size:14px"><strong>⏱ المدة المتوقعة:</strong> [مثلاً: ساعة واحدة]</p>
      <p style="margin:0;color:#475569;font-size:14px"><strong>📌 التأثير:</strong> [ما الذي سيتأثر]</p>
    </div>

    <p style="color:#6b7280;font-size:14px;line-height:1.7">
      نعتذر عن أي إزعاج. نعمل باستمرار على تحسين تجربتك.
    </p>

    <div style="${FOT}">
      <p>هذا إشعار تلقائي — لا ترد على هذا الإيميل.</p>
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
</div>`,
  },

  // ── 8. مخصص فارغ ────────────────────────────────────────────────────────
  {
    name: "✏️ إيميل مخصص",
    subject: "",
    sender: "hello",
    html: `<div dir="rtl" style="${BASE}">
  <div style="${HDR}">
    <h1 style="color:#fff;margin:0;font-size:24px">[العنوان]</h1>
  </div>
  <div style="${BOD}">
    <p style="color:#4b5563;line-height:1.7">[المحتوى]</p>
    <a href="https://visionex.app" style="${BTN}">[نص الزر]</a>
    <div style="${FOT}">
      <p>© 2026 Visionex · <a href="https://visionex.app" style="color:#6d28d9">visionex.app</a></p>
    </div>
  </div>
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
  const [sender, setSender] = useState("hello");

  const applyTemplate = (name: string) => {
    const t = EMAIL_TEMPLATES.find(t => t.name === name);
    if (t) { setSubject(t.subject); setHtml(t.html); setSelectedTemplate(name); setSender(t.sender || "hello"); }
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
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          type: tab === "newsletter" ? "newsletter" : "single",
          subject,
          html,
          from: sender,
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
              <Label>المرسِل</Label>
              <Select value={sender} onValueChange={setSender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENDERS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="font-mono text-sm">{s.label}</span>
                      <span className="ms-2 text-xs text-muted-foreground">— {s.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
