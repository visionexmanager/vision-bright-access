import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useSubjects } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useMyTeacherProfile, useBecomeTeacher, useMyCourses, useCreateCourse, usePublishCourse } from "@/features/visionkids/hooks/academy/useAcademyTeacher";
import type { AcademyAgeRange, AcademyDifficulty } from "@/features/visionkids/types/academy.types";

function BecomeTeacherForm() {
  const { t } = useLanguage();
  const becomeTeacher = useBecomeTeacher();
  const [name, setName] = useState("");

  return (
    <div className="mx-auto max-w-md rounded-2xl border-2 border-dashed border-border p-8 text-center">
      <GraduationCap className="mx-auto h-10 w-10 text-kids-primary" aria-hidden="true" />
      <p className="mt-2 font-heading text-lg font-bold">{t("kids.academy.becomeTeacherTitle")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("kids.academy.becomeTeacherDesc")}</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kids.academy.displayNamePlaceholder")} className="mt-4" />
      <Button
        onClick={() => becomeTeacher.mutate({ displayName: name.trim() || "Teacher" })}
        disabled={becomeTeacher.isPending}
        className="mt-3 gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90"
      >
        {becomeTeacher.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {t("kids.academy.becomeTeacher")}
      </Button>
    </div>
  );
}

function CreateCourseForm() {
  const { t } = useLanguage();
  const { data: subjects = [] } = useSubjects();
  const createCourse = useCreateCourse();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [ageRange, setAgeRange] = useState<AcademyAgeRange>("6-8");
  const [difficulty, setDifficulty] = useState<AcademyDifficulty>("easy");

  const submit = () => {
    if (!title.trim() || !subjectId) return;
    createCourse.mutate({ title: title.trim(), description: description.trim(), subjectId, ageRange, difficulty }, {
      onSuccess: () => { setTitle(""); setDescription(""); },
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 font-semibold"><Plus className="h-4 w-4 text-kids-primary" aria-hidden="true" /> {t("kids.academy.createCourse")}</p>
      <div className="flex flex-col gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("kids.academy.courseTitlePlaceholder")} />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("kids.academy.courseDescriptionPlaceholder")} />
        <div className="flex flex-wrap gap-2">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("kids.academy.subjectsTitle")} /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ageRange} onValueChange={(v) => setAgeRange(v as AcademyAgeRange)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{(["3-5", "6-8", "9-12", "13-15"] as const).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as AcademyDifficulty)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t("kids.academy.difficultyEasy")}</SelectItem>
              <SelectItem value="medium">{t("kids.academy.difficultyMedium")}</SelectItem>
              <SelectItem value="hard">{t("kids.academy.difficultyHard")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={submit} disabled={!title.trim() || !subjectId || createCourse.isPending} className="self-start bg-kids-primary text-white hover:bg-kids-primary/90">
          {t("kids.academy.createCourse")}
        </Button>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: teacherProfile, isLoading: profileLoading } = useMyTeacherProfile();
  const { data: courses = [] } = useMyCourses();
  const publishCourse = usePublishCourse();

  useDocumentHead({ title: t("kids.academy.teacherDashboardTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/teacher" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  if (profileLoading) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  const myTaughtCourses = courses.filter((c) => c.teacher_id === user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <GraduationCap className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.teacherDashboardTitle")}
      </h1>

      {!teacherProfile ? (
        <div className="mt-6"><BecomeTeacherForm /></div>
      ) : (
        <>
          <div className="mt-6"><CreateCourseForm /></div>

          <h2 className="mt-8 font-heading text-lg font-bold">{t("kids.academy.myTaughtCourses")}</h2>
          {myTaughtCourses.length === 0 ? (
            <p className="mt-3 text-muted-foreground">{t("kids.academy.noCoursesCreatedYet")}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {myTaughtCourses.map((course) => (
                <div key={course.id} className="flex items-center justify-between rounded-xl border-2 border-border bg-card p-3">
                  <Link to={`/kids/academy/teacher/course/${course.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.age_range} · {course.status}</p>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publishCourse.mutate({ courseId: course.id, publish: course.status !== "published" })}
                  >
                    {course.status === "published" ? t("kids.academy.unpublish") : t("kids.academy.publish")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
