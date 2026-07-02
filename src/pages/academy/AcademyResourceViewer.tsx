import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Bookmark, BookmarkCheck, Heart, User, Calendar, BookOpenText,
  Clock, Download, Sparkles, FileStack,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ResourceTypeBadge } from "@/components/academy/library/ResourceTypeBadge";
import { DifficultyBadge } from "@/components/academy/lms/DifficultyBadge";
import { ResourceCard } from "@/components/academy/library/ResourceCard";
import { ResourceNotesPanel } from "@/components/academy/library/ResourceNotesPanel";
import { ResourceHighlightsPanel } from "@/components/academy/library/ResourceHighlightsPanel";
import { ResourceReviewsSection } from "@/components/academy/library/ResourceReviewsSection";
import { PDFViewer } from "@/components/academy/library/PDFViewer";
import { AudioPlayer } from "@/components/academy/library/AudioPlayer";
import { PresentationViewer } from "@/components/academy/library/PresentationViewer";
import { DocumentViewer } from "@/components/academy/library/DocumentViewer";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import {
  getResourceByIdLocal, recordResourceView, searchResourcesLocal,
  getBookmarkedResourceIds, toggleBookmarkLocal, getFavoriteResourceIds, toggleFavoriteResourceLocal,
  getReadingProgressLocal, setReadingProgressLocal,
  getResourceNotesLocal, addResourceNoteLocal, removeResourceNoteLocal,
  getResourceHighlightsLocal, addResourceHighlightLocal, removeResourceHighlightLocal,
  getResourceReviewsLocal, addResourceReviewLocal,
} from "@/lib/academy/libraryLocalStore";

export default function AcademyResourceViewer() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const { user } = useAuth();

  const resource = resourceId ? getResourceByIdLocal(resourceId) : null;
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);

  useEffect(() => {
    if (resourceId) recordResourceView(resourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const isBookmarked = user && resourceId ? getBookmarkedResourceIds(user.id).includes(resourceId) : false;
  const isFavorite = user && resourceId ? getFavoriteResourceIds(user.id).includes(resourceId) : false;
  const progress = user && resourceId ? getReadingProgressLocal(user.id, resourceId) : null;
  const notes = resourceId ? getResourceNotesLocal(resourceId) : [];
  const highlights = resourceId ? getResourceHighlightsLocal(resourceId) : [];
  const reviews = resourceId ? getResourceReviewsLocal(resourceId) : [];

  const relatedResources = useMemo(() => {
    if (!resource) return [];
    return searchResourcesLocal({ category: resource.category }).filter((r) => r.id !== resource.id).slice(0, 4);
  }, [resource]);

  if (!resourceId) return <Navigate to="/academy/library" replace />;

  if (!resource) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذا المورد.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/library">تصفح المكتبة</Link></Button>
        </div>
      </Layout>
    );
  }

  const handleSetProgress = (percent: number) => {
    if (!user) return;
    setReadingProgressLocal(user.id, resource.id, { percent_complete: percent });
    bump();
  };

  const askMunirHref = `/academy?ask=${encodeURIComponent(`اشرح لي "${resource.title}" وساعدني أفهم أهم النقاط فيه`)}`;

  const renderViewer = () => {
    switch (resource.type) {
      case "pdf": return <PDFViewer title={resource.title} fileUrl={resource.url || null} />;
      case "audiobook": return <AudioPlayer title={resource.title} fileUrl={resource.url || null} />;
      case "presentation": return <PresentationViewer title={resource.title} fileUrl={resource.url || null} />;
      default: return <DocumentViewer title={resource.title} fileUrl={resource.url || null} />;
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 font-sans text-start">
        <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl">
          <Link to="/academy/library"><ArrowLeft className="w-4 h-4" aria-hidden="true" />المكتبة الرقمية</Link>
        </Button>

        {/* Header */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            <ResourceTypeBadge type={resource.type} />
            <DifficultyBadge difficulty={resource.difficulty} />
          </div>
          <h1 className="text-2xl font-black text-foreground">{resource.title}</h1>
          <p className="text-muted-foreground">{resource.description}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {resource.author && <span className="flex items-center gap-1"><User className="w-4 h-4" aria-hidden="true" />{resource.author}</span>}
            {resource.publication_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" aria-hidden="true" />{new Date(resource.publication_date).getFullYear()}</span>}
            {resource.pages && <span className="flex items-center gap-1"><BookOpenText className="w-4 h-4" aria-hidden="true" />{resource.pages} صفحة</span>}
            {resource.reading_time_minutes && <span className="flex items-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" />{resource.reading_time_minutes} د قراءة</span>}
            <span className="flex items-center gap-1"><Download className="w-4 h-4" aria-hidden="true" />{resource.downloads_count.toLocaleString()}</span>
          </div>

          {resource.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {resource.tags.map((t) => <span key={t} className="px-2.5 py-1 bg-muted rounded-lg text-xs text-muted-foreground">#{t}</span>)}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={isBookmarked ? "default" : "outline"}
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => { if (user) { toggleBookmarkLocal(user.id, resource.id); bump(); } }}
              disabled={!user}
            >
              {isBookmarked ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />}
              {isBookmarked ? "محفوظ" : "حفظ إشارة مرجعية"}
            </Button>
            <Button
              variant={isFavorite ? "default" : "outline"}
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => { if (user) { toggleFavoriteResourceLocal(user.id, resource.id); bump(); } }}
              disabled={!user}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} aria-hidden="true" />
              {isFavorite ? "في المفضّلة" : "إضافة للمفضّلة"}
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
              <Link to={askMunirHref}>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                اسأل منير عن هذا المورد
              </Link>
            </Button>
          </div>

          {user && (
            <div className="pt-2 space-y-1.5" aria-label={`تقدّم القراءة: ${progress?.percent_complete ?? 0}%`}>
              <Progress value={progress?.percent_complete ?? 0} className="h-2" />
              <div className="flex items-center gap-2 flex-wrap">
                {[25, 50, 75, 100].map((p) => (
                  <button key={p} onClick={() => handleSetProgress(p)} className="text-xs px-2 py-1 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted">
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Viewer */}
        {renderViewer()}

        {/* Tabs: notes / highlights / reviews */}
        <Tabs defaultValue="notes" className="bg-card rounded-2xl border border-border p-4">
          <TabsList className="grid grid-cols-3 rounded-xl">
            <TabsTrigger value="notes">ملاحظات</TabsTrigger>
            <TabsTrigger value="highlights">تمييزات</TabsTrigger>
            <TabsTrigger value="reviews">التقييمات</TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="pt-4">
            <ResourceNotesPanel
              notes={notes}
              onAddNote={(content) => { if (user) { addResourceNoteLocal(user.id, resource.id, content); bump(); } }}
              onRemoveNote={(id) => { removeResourceNoteLocal(id); bump(); }}
            />
          </TabsContent>
          <TabsContent value="highlights" className="pt-4">
            <ResourceHighlightsPanel
              highlights={highlights}
              onAddHighlight={(text) => { if (user) { addResourceHighlightLocal(user.id, resource.id, text); bump(); } }}
              onRemoveHighlight={(id) => { removeResourceHighlightLocal(id); bump(); }}
            />
          </TabsContent>
          <TabsContent value="reviews" className="pt-4">
            <ResourceReviewsSection
              reviews={reviews}
              ratingAvg={resource.rating_avg}
              ratingCount={resource.rating_count}
              onSubmitReview={(rating, comment) => { if (user) { addResourceReviewLocal(user.id, resource.id, rating, comment || null); bump(); } }}
            />
          </TabsContent>
        </Tabs>

        {/* Related */}
        {relatedResources.length > 0 && (
          <div>
            <AcademySectionHeader icon={FileStack} title="موارد ذات صلة" headingId="related-resources-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedResources.map((r) => <ResourceCard key={r.id} resource={r} />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
