import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Landmark, MapPin, Trophy, Globe, Heart, Sparkles, ArrowLeft,
  GraduationCap, Building2, Users, Wallet, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { StarRating } from "@/components/academy/lms/StarRating";
import { ResourceReviewsSection } from "@/components/academy/library/ResourceReviewsSection";
import {
  getUniversityByIdLocal, recordUniversityViewLocal, toggleFavoriteUniversityLocal,
  getFavoriteUniversityIds, getUniversityReviewsLocal, addUniversityReviewLocal,
} from "@/lib/academy/universityLocalStore";

export default function AcademyUniversityDetail() {
  const { universityId } = useParams<{ universityId: string }>();
  const { user } = useAuth();
  const university = universityId ? getUniversityByIdLocal(universityId) : null;
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);

  useEffect(() => {
    if (universityId && user) recordUniversityViewLocal(user.id, universityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId, user?.id]);

  if (!universityId) return <Navigate to="/academy/universities" replace />;

  if (!university) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذه الجامعة.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/universities">تصفح الجامعات</Link></Button>
        </div>
      </Layout>
    );
  }

  const isFavorite = user ? getFavoriteUniversityIds(user.id).includes(university.id) : false;
  const reviews = getUniversityReviewsLocal(university.id);
  const askMunirHref = `/academy?ask=${encodeURIComponent(`ساعدني أفهم متطلبات القبول في جامعة "${university.name}"`)}`;

  return (
    <Layout>
      <div className="font-sans text-start">
        <div className="h-40 md:h-56 bg-gradient-to-br from-primary/30 via-primary/10 to-background" aria-hidden="true" />

        <div className="p-4 md:p-8 max-w-5xl mx-auto -mt-16 space-y-8">
          <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl bg-background/80 backdrop-blur">
            <Link to="/academy/universities"><ArrowLeft className="w-4 h-4" aria-hidden="true" />دليل الجامعات</Link>
          </Button>

          <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-lg">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border-4 border-background shadow-lg" aria-hidden="true">
                <Landmark className="w-12 h-12" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-foreground">{university.name}</h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {university.city ? `${university.city}، ${university.country}` : university.country}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {university.ranking_global != null && (
                    <Badge variant="outline" className="gap-1"><Trophy className="w-3 h-3 text-yellow-500" aria-hidden="true" />الترتيب العالمي: {university.ranking_global}</Badge>
                  )}
                  {university.has_scholarships && <Badge variant="secondary">منح متاحة</Badge>}
                  <StarRating rating={university.rating_avg} count={university.rating_count} />
                </div>
              </div>
            </div>

            {university.description && <p className="text-foreground mt-6">{university.description}</p>}

            <div className="flex flex-wrap gap-2 mt-6">
              <Button
                variant={isFavorite ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-xl"
                disabled={!user}
                onClick={() => { if (user) { toggleFavoriteUniversityLocal(user.id, university.id); bump(); } }}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} aria-hidden="true" />
                {isFavorite ? "في المفضّلة" : "إضافة للمفضّلة"}
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
                <Link to={askMunirHref}><Sparkles className="w-4 h-4" aria-hidden="true" />اسأل منير عن القبول</Link>
              </Button>
              {university.website_url && (
                <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
                  <a href={university.website_url} target="_blank" rel="noopener noreferrer"><Globe className="w-4 h-4" aria-hidden="true" />الموقع الرسمي</a>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {university.degrees_offered.length > 0 && (
              <div className="bg-card p-6 rounded-3xl border border-border">
                <AcademySectionHeader icon={GraduationCap} title="الدرجات العلمية المتاحة" headingId="degrees-heading" />
                <div className="flex flex-wrap gap-1.5">{university.degrees_offered.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}</div>
              </div>
            )}
            {university.faculties.length > 0 && (
              <div className="bg-card p-6 rounded-3xl border border-border">
                <AcademySectionHeader icon={Building2} title="الكليات" headingId="faculties-heading" />
                <div className="flex flex-wrap gap-1.5">{university.faculties.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</div>
              </div>
            )}
          </div>

          {university.programs.length > 0 && (
            <div className="bg-card p-6 rounded-3xl border border-border">
              <AcademySectionHeader icon={GraduationCap} title="البرامج الدراسية" headingId="programs-heading" />
              <div className="flex flex-wrap gap-1.5">{university.programs.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}</div>
            </div>
          )}

          {(university.admission_requirements || university.tuition_fee_range) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {university.admission_requirements && (
                <div className="bg-card p-6 rounded-3xl border border-border">
                  <AcademySectionHeader icon={GraduationCap} title="متطلبات القبول" headingId="admission-heading" />
                  <p className="text-sm text-foreground whitespace-pre-line">{university.admission_requirements}</p>
                </div>
              )}
              {university.tuition_fee_range && (
                <div className="bg-card p-6 rounded-3xl border border-border">
                  <AcademySectionHeader icon={Wallet} title="الرسوم الدراسية" headingId="tuition-heading" />
                  <p className="text-sm text-foreground">{university.tuition_fee_range}</p>
                </div>
              )}
            </div>
          )}

          {(university.student_life_description || university.facilities.length > 0 || university.international_students_percent != null) && (
            <div className="bg-card p-6 rounded-3xl border border-border">
              <AcademySectionHeader icon={Users} title="الحياة الطلابية والمرافق" headingId="student-life-heading" />
              {university.international_students_percent != null && (
                <p className="text-sm text-muted-foreground mb-2">نسبة الطلاب الدوليين: {university.international_students_percent}%</p>
              )}
              {university.student_life_description && <p className="text-sm text-foreground mb-3">{university.student_life_description}</p>}
              {university.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{university.facilities.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</div>
              )}
            </div>
          )}

          <div className="bg-card p-6 md:p-8 rounded-3xl border border-border">
            <AcademySectionHeader icon={MessageSquare} title="آراء الطلاب" headingId="university-reviews-heading" />
            <ResourceReviewsSection
              reviews={reviews.map((r) => ({ id: r.id, user_id: r.user_id, resource_id: r.university_id, rating: r.rating, comment: r.comment, created_at: r.created_at }))}
              ratingAvg={university.rating_avg}
              ratingCount={university.rating_count}
              onSubmitReview={(rating, comment) => { if (user) { addUniversityReviewLocal(user.id, university.id, rating, comment || null); bump(); } }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
