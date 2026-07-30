import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useClasses, useTimetable, useCreateTimetableEntry } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { useCurrentOrg } from "@/features/visionkids/hooks/enterprise/useCurrentOrg";
import { WEEKDAYS } from "@/features/visionkids/data/enterpriseConfig";
import { EnterpriseHeader, NoOrgPrompt } from "@/features/visionkids/components/enterprise/EnterpriseHeader";

export default function Timetable() {
  const { t } = useLanguage();
  const { orgId, isStaff } = useCurrentOrg();
  const { data: classes = [] } = useClasses(orgId ?? undefined);
  const [classId, setClassId] = useState("");
  const activeClass = classId || classes[0]?.id || "";
  const { data: entries = [] } = useTimetable(activeClass || undefined);
  const create = useCreateTimetableEntry();

  const [day, setDay] = useState(1);
  const [period, setPeriod] = useState(1);
  const [subject, setSubject] = useState("");

  useDocumentHead({
    title: `${t("kids.enterprise.nav.timetable")} — VisionKids`,
    description: t("kids.enterprise.timetable.subtitle"),
    canonicalPath: "/kids/enterprise/timetable",
  });

  const byDay = useMemo(() => {
    const map = new Map<number, typeof entries>();
    for (const e of entries) { const arr = map.get(e.day_of_week) ?? []; arr.push(e); map.set(e.day_of_week, arr); }
    return map;
  }, [entries]);

  async function add() {
    if (!orgId || !activeClass || !subject.trim()) return;
    await create.mutateAsync({ orgId, classId: activeClass, dayOfWeek: day, period, subject: subject.trim() }).catch(() => {});
    setSubject("");
  }

  if (!orgId) return <div className="mx-auto max-w-3xl px-4 py-10"><EnterpriseHeader emoji="🗓️" title={t("kids.enterprise.nav.timetable")} /><NoOrgPrompt /></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <EnterpriseHeader emoji="🗓️" title={t("kids.enterprise.nav.timetable")} subtitle={t("kids.enterprise.timetable.subtitle")} />

      <div className="mt-5">
        <select value={activeClass} onChange={(e) => setClassId(e.target.value)} aria-label={t("kids.enterprise.attendance.class")}
          className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isStaff && activeClass && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-border bg-card p-4">
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="rounded-xl border-2 border-border bg-background px-3 py-2 text-sm">
            {WEEKDAYS.map((d) => <option key={d} value={d}>{t(`kids.enterprise.weekday.${d}`)}</option>)}
          </select>
          <input type="number" min={1} max={12} value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="w-20 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" aria-label={t("kids.enterprise.timetable.period")} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("kids.enterprise.timetable.subject")} className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm" />
          <button type="button" onClick={add} disabled={!subject.trim() || create.isPending} className="inline-flex items-center gap-1 rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.enterprise.timetable.add")}</button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WEEKDAYS.map((d) => {
          const dayEntries = (byDay.get(d) ?? []).sort((a, b) => a.period - b.period);
          if (dayEntries.length === 0) return null;
          return (
            <div key={d} className="rounded-2xl border-2 border-border bg-card p-4">
              <p className="font-heading font-bold">{t(`kids.enterprise.weekday.${d}`)}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {dayEntries.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-kids-primary/10 text-xs font-bold text-kids-primary">{e.period}</span>
                    {e.subject}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
