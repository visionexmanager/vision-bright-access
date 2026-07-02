import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User, BadgeCheck, Globe, Linkedin, Youtube, Twitter, Instagram,
  Users, BookOpen, Star, MapPin, Languages, Award, ArrowLeft,
} from "lucide-react";
import { InstructorLevelBadge } from "@/components/academy/lms/InstructorLevelBadge";
import { CourseCard } from "@/components/academy/lms/CourseCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { getInstructorByIdAny, getCoursesByInstructorAny } from "@/lib/academy/instructorLocalStore";
import { getOrganizationById } from "@/lib/academy/mockOrganizations";

const SOCIAL_ICONS = { website: Globe, linkedin: Linkedin, youtube: Youtube, twitter: Twitter, instagram: Instagram } as const;

export default function AcademyInstructorProfile() {
  const { instructorId } = useParams<{ instructorId: string }>();
  const instructor = instructorId ? getInstructorByIdAny(instructorId) : null;
  const courses = useMemo(() => (instructorId ? getCoursesByInstructorAny(instructorId) : []), [instructorId]);
  const organization = instructor?.organization_id ? getOrganizationById(instructor.organization_id) : null;

  if (!instructorId) return <Navigate to="/academy/courses" replace />;

  if (!instructor) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذا المدرّس.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/courses">تصفح الدورات</Link></Button>
        </div>
      </Layout>
    );
  }

  const totalStudents = courses.reduce((sum, c) => sum + c.students_count, 0);

  return (
    <Layout>
      <div className="font-sans text-start">
        {/* Cover */}
        <div className="h-40 md:h-56 bg-gradient-to-br from-primary/30 via-primary/10 to-background" aria-hidden="true" />

        <div className="p-4 md:p-8 max-w-5xl mx-auto -mt-16 space-y-8">
          <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl bg-background/80 backdrop-blur">
            <Link to="/academy/courses">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              كل الدورات
            </Link>
          </Button>

          {/* Header card */}
          <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-lg">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border-4 border-background shadow-lg" aria-hidden="true">
                <User className="w-12 h-12" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-foreground">{instructor.name}</h1>
                  {instructor.verified && <BadgeCheck className="w-5 h-5 text-primary" aria-label="مدرّس موثّق" />}
                </div>
                {instructor.headline && <p className="text-muted-foreground mt-1">{instructor.headline}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  <InstructorLevelBadge level={instructor.level} />
                  {organization && (
                    <Badge variant="secondary">{organization.name}</Badge>
                  )}
                  {instructor.country && (
                    <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" aria-hidden="true" />{instructor.country}</Badge>
                  )}
                </div>
              </div>
            </div>

            {instructor.bio && <p className="text-foreground mt-6">{instructor.bio}</p>}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-black text-foreground flex items-center justify-center gap-1.5">
                  <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />{courses.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">دورات</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-foreground flex items-center justify-center gap-1.5">
                  <Users className="w-5 h-5 text-primary" aria-hidden="true" />{totalStudents.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">طالب</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-foreground flex items-center justify-center gap-1.5">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                  {instructor.rating != null ? instructor.rating.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">التقييم</p>
              </div>
            </div>

            {/* Expertise / Skills / Languages / Certifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {instructor.expertise.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Award className="w-3.5 h-3.5" aria-hidden="true" />مجالات الخبرة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {instructor.expertise.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
                  </div>
                </div>
              )}
              {instructor.languages.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Languages className="w-3.5 h-3.5" aria-hidden="true" />اللغات</p>
                  <div className="flex flex-wrap gap-1.5">
                    {instructor.languages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                  </div>
                </div>
              )}
            </div>

            {instructor.certifications.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">الشهادات والاعتمادات</p>
                <ul className="space-y-1">
                  {instructor.certifications.map((c) => (
                    <li key={c} className="text-sm text-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Social links */}
            {Object.keys(instructor.social_links).length > 0 && (
              <div className="flex gap-2 mt-6">
                {(Object.entries(instructor.social_links) as [keyof typeof SOCIAL_ICONS, string][]).map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key];
                  if (!Icon || !url) return null;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                      aria-label={key}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Courses */}
          <div>
            <AcademySectionHeader icon={BookOpen} title={`دورات ${instructor.name}`} headingId="instructor-courses-heading" />
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 border-2 border-dashed border-border rounded-3xl">
                لم ينشر هذا المدرّس أي دورة بعد.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((c) => <CourseCard key={c.id} course={c} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
