import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Sparkles, Library, Check, X, Languages, Network, GraduationCap } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStudioBookDetail } from "@/hooks/library/useStudioBookDetail";
import { useBecomeAuthor } from "@/hooks/library/useBecomeAuthor";
import { useClaimPendingInvitations } from "@/hooks/library/useCollaborators";
import { useBookClassification } from "@/hooks/library/useBookClassification";
import { useSeriesSuggestions } from "@/hooks/library/useSeriesSuggestions";
import { useBookTranslations } from "@/hooks/library/useBookTranslations";
import { useBuildKnowledgeGraph, useEntitiesForBook } from "@/hooks/library/useKnowledgeGraph";
import { useBookToCourse } from "@/hooks/library/useBookToCourse";
import { EditionHistoryPanel } from "@/components/library/studio/EditionHistoryPanel";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { CollaboratorsPanel } from "@/components/library/studio/collaboration/CollaboratorsPanel";
import { ApprovalWorkflowBar } from "@/components/library/studio/pricing/ApprovalWorkflowBar";
import { CouponManager } from "@/components/library/studio/pricing/CouponManager";
import { RegionalPricingTable } from "@/components/library/studio/pricing/RegionalPricingTable";
import { BundleBuilder } from "@/components/library/studio/pricing/BundleBuilder";
import type { LibraryPricingModel } from "@/lib/types/library-studio";

const PRICING_MODELS: LibraryPricingModel[] = ["free", "paid", "subscription", "rental", "donation", "bundle"];

export default function LibraryStudioBookOverview() {
  const { t } = useLanguage();
  const { bookId } = useParams<{ bookId: string }>();
  const { book, isLoading, updateMetadata, updatePublishStatus } = useStudioBookDetail(bookId);
  const { authorProfile } = useBecomeAuthor();
  const claimInvitations = useClaimPendingInvitations();
  const { classify, isClassifying } = useBookClassification(bookId);
  const { suggestions: seriesSuggestions, isDetecting, detect: detectSeries, approve: approveSeries, reject: rejectSeries } = useSeriesSuggestions(bookId, authorProfile?.id);
  const { translations, translate, isTranslating } = useBookTranslations(bookId);
  const { build: buildKnowledgeGraph, isBuilding: isBuildingGraph } = useBuildKnowledgeGraph(bookId);
  const { entities: linkedEntities } = useEntitiesForBook(bookId);
  const { link: courseLink, isConverting, convert: convertToCourse } = useBookToCourse(bookId);
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseLevel, setCourseLevel] = useState("beginner");

  useDocumentHead({ title: book ? `${t("library.studio.overview.title")} — ${book.title}` : t("library.studio.overview.title") });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [doi, setDoi] = useState("");
  const [issn, setIssn] = useState("");

  useEffect(() => {
    void claimInvitations();
  }, [claimInvitations]);

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setDescription(book.description);
      setPriceUsd(book.price_usd != null ? String(book.price_usd) : "");
      setDoi(book.doi ?? "");
      setIssn(book.issn ?? "");
    }
  }, [book]);

  if (isLoading || !book || !bookId) {
    return (
      <Layout>
        <LibraryLayout title={t("library.studio.overview.title")}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </LibraryLayout>
      </Layout>
    );
  }

  const saveDetails = () => void updateMetadata({ title, description });
  const saveAcademicIds = () => void updateMetadata({ doi: doi.trim() || null, issn: issn.trim() || null });
  const savePricingModel = (pricing_model: LibraryPricingModel) => void updateMetadata({ pricing_model, is_free: pricing_model === "free" || pricing_model === "donation" });
  const savePrice = () => void updateMetadata({ price_usd: priceUsd ? Number(priceUsd) : null });

  return (
    <Layout>
      <LibraryLayout title={book.title} breadcrumb={[{ label: t("library.studio.dashboard.title"), to: "/library/studio" }, { label: book.title }]}>
        <div className="space-y-4">
          <ApprovalWorkflowBar status={book.publish_status} reviewNote={book.review_note} onTransition={updatePublishStatus} />

          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">{t("library.studio.overview.tab.details")}</TabsTrigger>
              <TabsTrigger value="collaborators">{t("library.studio.overview.tab.collaborators")}</TabsTrigger>
              <TabsTrigger value="pricing">{t("library.studio.overview.tab.pricing")}</TabsTrigger>
              <TabsTrigger value="organization">{t("library.studio.overview.tab.organization")}</TabsTrigger>
              <TabsTrigger value="seo">{t("library.studio.overview.tab.seo")}</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card className="space-y-3 p-5">
                <div>
                  <Label htmlFor="overview-title">{t("library.studio.wizard.titleLabel")}</Label>
                  <Input id="overview-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="overview-description">{t("library.studio.wizard.descriptionLabel")}</Label>
                  <Textarea id="overview-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
                <Button onClick={saveDetails}>{t("library.common.save")}</Button>
              </Card>

              <Card className="mt-4 space-y-3 p-5">
                <h2 className="text-sm font-semibold">{t("library.studio.academic.title")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="overview-doi">{t("library.studio.academic.doi")}</Label>
                    <Input id="overview-doi" value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1000/xyz123" />
                  </div>
                  <div>
                    <Label htmlFor="overview-issn">{t("library.studio.academic.issn")}</Label>
                    <Input id="overview-issn" value={issn} onChange={(e) => setIssn(e.target.value)} placeholder="1234-5678" />
                  </div>
                </div>
                <Button onClick={saveAcademicIds}>{t("library.common.save")}</Button>
              </Card>
            </TabsContent>

            <TabsContent value="collaborators">
              <Card className="p-5"><CollaboratorsPanel bookId={bookId} /></Card>
            </TabsContent>

            <TabsContent value="pricing">
              <div className="space-y-4">
                <Card className="space-y-3 p-5">
                  <Label>{t("library.studio.wizard.pricingModelLabel")}</Label>
                  <Select value={book.pricing_model} onValueChange={(v) => savePricingModel(v as LibraryPricingModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_MODELS.map((p) => <SelectItem key={p} value={p}>{t(`library.studio.pricingModel.${p}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(book.pricing_model === "paid" || book.pricing_model === "rental") && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="overview-price">{t("library.studio.wizard.priceUsdLabel")}</Label>
                        <Input id="overview-price" type="number" min="0" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
                      </div>
                      <Button onClick={savePrice}>{t("library.common.save")}</Button>
                    </div>
                  )}
                </Card>
                <Card className="p-5"><CouponManager bookId={bookId} /></Card>
                <Card className="p-5"><RegionalPricingTable bookId={bookId} /></Card>
                {authorProfile && <Card className="p-5"><BundleBuilder authorId={authorProfile.id} currentBookId={bookId} /></Card>}
              </div>
            </TabsContent>

            <TabsContent value="organization">
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{t("library.studio.organization.title")}</h2>
                    <p className="text-xs text-muted-foreground">{t("library.studio.organization.description")}</p>
                  </div>
                  <Button size="sm" onClick={() => void classify()} disabled={isClassifying} className="gap-1.5 shrink-0">
                    {isClassifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("library.studio.organization.classify")}
                  </Button>
                </div>

                {book.topics.length === 0 && book.subtopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("library.studio.organization.empty")}</p>
                ) : (
                  <>
                    <div>
                      <Label>{t("library.studio.organization.topics")}</Label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {book.topics.map((topic) => <Badge key={topic} variant="secondary">{topic}</Badge>)}
                      </div>
                    </div>
                    {book.subtopics.length > 0 && (
                      <div>
                        <Label>{t("library.studio.organization.subtopics")}</Label>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {book.subtopics.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-6 text-sm">
                      {book.difficultyLevel && (
                        <p><span className="text-muted-foreground">{t("library.studio.organization.difficulty")}: </span><span className="font-medium">{t(`library.bookDetails.difficulty.${book.difficultyLevel}`)}</span></p>
                      )}
                      {book.readingLevel && (
                        <p><span className="text-muted-foreground">{t("library.studio.organization.readingLevel")}: </span><span className="font-medium">{t(`library.readingLevel.${book.readingLevel}`)}</span></p>
                      )}
                    </div>
                  </>
                )}
              </Card>

              {!book.seriesId && (
                <Card className="mt-4 space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Library className="h-4 w-4" aria-hidden="true" /> {t("library.studio.series.title")}</h2>
                      <p className="text-xs text-muted-foreground">{t("library.studio.series.description")}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void detectSeries()} disabled={isDetecting} className="gap-1.5 shrink-0">
                      {isDetecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                      {t("library.studio.series.detect")}
                    </Button>
                  </div>

                  {seriesSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {suggestion.suggested_series_title ?? t("library.studio.series.existingSeries")}
                        {suggestion.suggested_position != null && ` — #${suggestion.suggested_position}`}
                      </p>
                      {suggestion.reasoning && <p className="mt-1 text-xs text-muted-foreground">{suggestion.reasoning}</p>}
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" className="gap-1" onClick={() => void approveSeries(suggestion.id)}>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.studio.series.approve")}
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => void rejectSeries(suggestion.id)}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.studio.series.reject")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              <Card className="mt-4 space-y-3 p-5">
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Languages className="h-4 w-4" aria-hidden="true" /> {t("library.studio.translations.title")}</h2>
                  <p className="text-xs text-muted-foreground">{t("library.studio.translations.description")}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor="translate-target-lang">{t("library.studio.translations.targetLanguage")}</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger id="translate-target-lang" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"].filter((code) => code !== book.language).map((code) => (
                          <SelectItem key={code} value={code}>{t(`library.language.${code}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void translate(targetLanguage)} disabled={isTranslating} className="gap-1.5">
                    {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("library.studio.translations.translate")}
                  </Button>
                </div>
                {translations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {translations.map((tr) => <Badge key={tr.language_code} variant="secondary">{t(`library.language.${tr.language_code}`)}</Badge>)}
                  </div>
                )}
              </Card>

              <Card className="mt-4 space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Network className="h-4 w-4" aria-hidden="true" /> {t("library.studio.knowledgeGraph.title")}</h2>
                    <p className="text-xs text-muted-foreground">{t("library.studio.knowledgeGraph.description")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void buildKnowledgeGraph()} disabled={isBuildingGraph} className="gap-1.5 shrink-0">
                    {isBuildingGraph ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("library.studio.knowledgeGraph.build")}
                  </Button>
                </div>
                {linkedEntities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("library.studio.knowledgeGraph.empty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {linkedEntities.map((entity) => (
                      <Link
                        key={entity.id}
                        to={`/library/knowledge-graph/${entity.slug}`}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${KG_ENTITY_TYPE_COLORS[entity.entity_type].badge}`}
                      >
                        {entity.name}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="mt-4 space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><GraduationCap className="h-4 w-4" aria-hidden="true" /> {t("library.studio.bookToCourse.title")}</h2>
                    <p className="text-xs text-muted-foreground">{t("library.studio.bookToCourse.description")}</p>
                  </div>
                  {courseLink ? (
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link to={`/academy/courses/${courseLink.academy_course_id}`}>{t("library.studio.bookToCourse.viewCourse")}</Link>
                    </Button>
                  ) : (
                    <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setCourseTitle(book.title)}>
                          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.studio.bookToCourse.convert")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{t("library.studio.bookToCourse.title")}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="course-title">{t("library.studio.bookToCourse.titleLabel")}</Label>
                            <Input id="course-title" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
                          </div>
                          <div>
                            <Label>{t("library.studio.bookToCourse.levelLabel")}</Label>
                            <Select value={courseLevel} onValueChange={setCourseLevel}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">{t("library.learningPaths.level.beginner")}</SelectItem>
                                <SelectItem value="intermediate">{t("library.learningPaths.level.intermediate")}</SelectItem>
                                <SelectItem value="advanced">{t("library.learningPaths.level.advanced")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            disabled={!courseTitle.trim() || isConverting}
                            onClick={async () => {
                              const courseId = await convertToCourse(courseTitle.trim(), courseLevel);
                              if (courseId) setCourseDialogOpen(false);
                            }}
                          >
                            {isConverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("library.studio.bookToCourse.convert")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {courseLink && <p className="text-sm text-muted-foreground">{t("library.studio.bookToCourse.alreadyConverted")}</p>}
              </Card>

              <EditionHistoryPanel bookId={bookId} />
            </TabsContent>

            <TabsContent value="seo">
              <Card className="space-y-3 p-5">
                <h2 className="text-sm font-semibold">{t("library.studio.seo.preview")}</h2>
                <div className="rounded-md border p-3">
                  <p className="text-primary underline">{book.title}</p>
                  <p className="text-xs text-muted-foreground">visionex.app/library/books/{book.slug}</p>
                  <p className="mt-1 text-sm">{book.description}</p>
                </div>
                <div>
                  <Label>{t("library.studio.seo.keywords")}</Label>
                  <p className="text-sm text-muted-foreground">{(book.keywords ?? []).join(", ") || t("library.studio.seo.noKeywords")}</p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
