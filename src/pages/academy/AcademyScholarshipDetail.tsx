import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, MapPin, GraduationCap, Wallet, CalendarClock, Mail, ExternalLink,
  Bookmark, BookmarkCheck, Sparkles, CheckCircle2, FileText, Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  getScholarshipByIdLocal, recordScholarshipViewLocal, toggleSavedScholarshipLocal,
  getSavedScholarshipIds, createDeadlineReminderLocal, getDeadlineRemindersLocal,
} from "@/lib/academy/scholarshipLocalStore";

const STATUS_LABEL: Record<string, string> = { open: "مفتوحة", closing_soon: "تنتهي قريباً", closed: "مغلقة", upcoming: "قادمة" };
const FUNDING_LABEL: Record<string, string> = { full: "تمويل كامل", partial: "تمويل جزئي", tuition_only: "الرسوم فقط", stipend_only: "راتب شهري فقط" };

export default function AcademyScholarshipDetail() {
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const { user } = useAuth();
  const scholarship = scholarshipId ? getScholarshipByIdLocal(scholarshipId) : null;
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);
  const [reminderDays, setReminderDays] = useState("7");

  useEffect(() => {
    if (scholarshipId && user) recordScholarshipViewLocal(user.id, scholarshipId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarshipId, user?.id]);

  if (!scholarshipId) return <Navigate to="/academy/scholarships" replace />;

  if (!scholarship) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذه المنحة.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/scholarships">تصفح المنح</Link></Button>
        </div>
      </Layout>
    );
  }

  const isSaved = user ? getSavedScholarshipIds(user.id).includes(scholarship.id) : false;
  const reminders = user ? getDeadlineRemindersLocal(user.id).filter((r) => r.scholarship_id === scholarship.id) : [];
  const askMunirHref = `/academy?ask=${encodeURIComponent(`هل أنا مؤهل لمنحة "${scholarship.title}"؟ اشرح لي شروط الأهلية والمستندات المطلوبة`)}`;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 font-sans text-start">
        <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl">
          <Link to="/academy/scholarships"><ArrowLeft className="w-4 h-4" aria-hidden="true" />مركز المنح</Link>
        </Button>

        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{STATUS_LABEL[scholarship.status]}</Badge>
            <Badge variant="secondary" className="gap-1"><Wallet className="w-3 h-3" aria-hidden="true" />{FUNDING_LABEL[scholarship.funding_level]}</Badge>
          </div>
          <h1 className="text-2xl font-black text-foreground">{scholarship.title}</h1>
          <p className="text-muted-foreground">{scholarship.provider}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" aria-hidden="true" />{scholarship.country}</span>
            {scholarship.degree && <span className="flex items-center gap-1"><GraduationCap className="w-4 h-4" aria-hidden="true" />{scholarship.degree}</span>}
            {scholarship.deadline && <span className="flex items-center gap-1"><CalendarClock className="w-4 h-4" aria-hidden="true" />الموعد النهائي: {new Date(scholarship.deadline).toLocaleDateString()}</span>}
            {scholarship.amount && <span>{scholarship.amount}</span>}
          </div>

          {scholarship.study_fields.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scholarship.study_fields.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={isSaved ? "default" : "outline"}
              size="sm"
              className="gap-2 rounded-xl"
              disabled={!user}
              onClick={() => { if (user) { toggleSavedScholarshipLocal(user.id, scholarship.id); bump(); } }}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />}
              {isSaved ? "محفوظة" : "حفظ المنحة"}
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
              <Link to={askMunirHref}><Sparkles className="w-4 h-4" aria-hidden="true" />اسأل منير عن أهليتي</Link>
            </Button>
            {scholarship.website_url && (
              <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
                <a href={scholarship.website_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" aria-hidden="true" />الموقع الرسمي</a>
              </Button>
            )}
          </div>
        </div>

        {/* Eligibility & Documents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scholarship.eligibility.length > 0 && (
            <div className="bg-card p-6 rounded-3xl border border-border">
              <AcademySectionHeader icon={CheckCircle2} title="شروط الأهلية" headingId="eligibility-heading" />
              <ul className="space-y-2">
                {scholarship.eligibility.map((e) => (
                  <li key={e} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scholarship.required_documents.length > 0 && (
            <div className="bg-card p-6 rounded-3xl border border-border">
              <AcademySectionHeader icon={FileText} title="المستندات المطلوبة" headingId="documents-heading" />
              <ul className="space-y-2">
                {scholarship.required_documents.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" aria-hidden="true" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {scholarship.application_process && (
          <div className="bg-card p-6 rounded-3xl border border-border">
            <AcademySectionHeader icon={FileText} title="آلية التقديم" headingId="process-heading" />
            <p className="text-sm text-foreground whitespace-pre-line">{scholarship.application_process}</p>
          </div>
        )}

        {scholarship.contact_email && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" aria-hidden="true" />
            للتواصل: <a href={`mailto:${scholarship.contact_email}`} className="text-primary hover:underline">{scholarship.contact_email}</a>
          </p>
        )}

        {/* Deadline reminder */}
        {user && scholarship.deadline && (
          <div className="bg-card p-6 rounded-3xl border border-border">
            <AcademySectionHeader icon={Bell} title="تذكير بالموعد النهائي" headingId="reminder-heading" />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={reminderDays} onValueChange={setReminderDays}>
                <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">قبل يوم واحد</SelectItem>
                  <SelectItem value="3">قبل 3 أيام</SelectItem>
                  <SelectItem value="7">قبل أسبوع</SelectItem>
                  <SelectItem value="14">قبل أسبوعين</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="rounded-xl" onClick={() => { createDeadlineReminderLocal(user.id, scholarship.id, Number(reminderDays)); bump(); }}>
                إضافة تذكير
              </Button>
            </div>
            {reminders.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                لديك {reminders.length} تذكير مفعّل لهذه المنحة. (إرسال الإشعارات الفعلي قيد التطوير)
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
