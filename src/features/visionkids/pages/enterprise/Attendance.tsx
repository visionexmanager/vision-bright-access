import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useClasses, useClassRoster, useAttendance, useMarkAttendance, useMembers } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { ATTENDANCE_STATUSES, ENT_COLOR_CLASSES } from "@/features/visionkids/data/enterpriseConfig";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";
import type { AttendanceStatus } from "@/features/visionkids/types/enterprise.types";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: classes = [] } = useClasses(orgId ?? undefined);
  const { data: members = [] } = useMembers(orgId ?? undefined, "student");

  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const activeClass = classId || classes[0]?.id || "";

  const { data: roster = [] } = useClassRoster(activeClass || undefined);
  const { data: records = [] } = useAttendance(activeClass || undefined, date);
  const mark = useMarkAttendance();

  useDocumentHead({
    title: `${t("kids.enterprise.nav.attendance")} — VisionKids`,
    description: t("kids.enterprise.attendance.subtitle"),
    canonicalPath: "/kids/enterprise/attendance",
  });

  const nameById = useMemo(() => new Map(members.map((m) => [m.user_id, m.display_name])), [members]);
  const statusById = useMemo(() => new Map(records.map((r) => [r.student_id, r.status])), [records]);

  if (!orgId) return <div className="mx-auto max-w-3xl px-4 py-10"><EnterpriseHeader emoji="📋" title={t("kids.enterprise.nav.attendance")} /><NoOrgPrompt /></div>;
  if (!isStaff) return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <EnterpriseHeader emoji="📋" title={t("kids.enterprise.nav.attendance")} subtitle={t("kids.enterprise.attendance.subtitle")} />
      <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.staffOnly")}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="📋" title={t("kids.enterprise.nav.attendance")} subtitle={t("kids.enterprise.attendance.subtitle")} />

      <div className="mt-5 flex flex-wrap gap-2">
        <select value={activeClass} onChange={(e) => setClassId(e.target.value)} aria-label={t("kids.enterprise.attendance.class")}
          className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("kids.enterprise.attendance.date")}
          className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium" />
      </div>

      {roster.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.enterprise.attendance.noStudents")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {roster.map((r) => {
            const status = statusById.get(r.student_id);
            return (
              <li key={r.student_id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-border bg-card p-3">
                <span className="min-w-0 flex-1 truncate font-semibold">{nameById.get(r.student_id) ?? r.student_id}</span>
                <div className="flex gap-1">
                  {ATTENDANCE_STATUSES.map((s) => (
                    <button key={s.status} type="button" disabled={mark.isPending}
                      onClick={() => mark.mutate({ classId: activeClass, studentId: r.student_id, date, status: s.status as AttendanceStatus })}
                      aria-pressed={status === s.status}
                      className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-colors ${status === s.status ? ENT_COLOR_CLASSES[s.color] : "border-border hover:border-kids-primary/50"}`}>
                      {s.emoji} {t(`kids.enterprise.attendanceStatus.${s.status}`)}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
