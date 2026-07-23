import { useState } from "react";
import { Route, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { LearningPathCard } from "@/components/library/learning/LearningPathCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLearningPaths } from "@/hooks/library/useLearningPaths";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryLearningPathLevel } from "@/lib/types/library-learning";

const LEVELS: LibraryLearningPathLevel[] = ["beginner", "intermediate", "advanced", "professional", "certification", "custom"];

export default function LibraryLearningPaths() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [scope, setScope] = useState<"published" | "mine">("published");
  const { paths, isLoading, create } = useLearningPaths(scope);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<LibraryLearningPathLevel>("beginner");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [isCertificationTrack, setIsCertificationTrack] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  useDocumentHead({ title: t("library.learningPaths.title") });

  const resetForm = () => {
    setTitle(""); setDescription(""); setLevel("beginner");
    setEstimatedMinutes(""); setIsAdaptive(false); setIsCertificationTrack(false); setIsPublished(true);
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.learningPaths.title")}
        breadcrumb={[{ label: t("library.learningPaths.title") }]}
        headerActions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.learningPaths.create")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("library.learningPaths.createTitle")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="lp-title">{t("library.learningPaths.titleLabel")}</Label>
                    <Input id="lp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="lp-desc">{t("library.learningPaths.descriptionLabel")}</Label>
                    <Textarea id="lp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t("library.learningPaths.level")}</Label>
                      <Select value={level} onValueChange={(v) => setLevel(v as LibraryLearningPathLevel)}>
                        <SelectTrigger aria-label={t("library.learningPaths.level")}><SelectValue /></SelectTrigger>
                        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{t(`library.learningPaths.level.${l}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="lp-minutes">{t("library.learningPaths.estimatedMinutes")}</Label>
                      <Input id="lp-minutes" type="number" min={0} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="lp-adaptive" checked={isAdaptive} onCheckedChange={(v) => setIsAdaptive(v === true)} />
                    <Label htmlFor="lp-adaptive" className="text-sm font-normal">{t("library.learningPaths.isAdaptive")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="lp-cert" checked={isCertificationTrack} onCheckedChange={(v) => setIsCertificationTrack(v === true)} />
                    <Label htmlFor="lp-cert" className="text-sm font-normal">{t("library.learningPaths.isCertificationTrack")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="lp-published" checked={isPublished} onCheckedChange={(v) => setIsPublished(v === true)} />
                    <Label htmlFor="lp-published" className="text-sm font-normal">{t("library.learningPaths.isPublished")}</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!title.trim()}
                    onClick={async () => {
                      await create({
                        title: title.trim(), description: description.trim() || null, level,
                        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
                        is_adaptive: isAdaptive, is_certification_track: isCertificationTrack, is_published: isPublished,
                      });
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    {t("library.learningPaths.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        {user && (
          <Tabs value={scope} onValueChange={(v) => setScope(v as "published" | "mine")} className="mb-4">
            <TabsList>
              <TabsTrigger value="published">{t("library.learningPaths.discover")}</TabsTrigger>
              <TabsTrigger value="mine">{t("library.learningPaths.myPaths")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : paths.length === 0 ? (
          <EmptyState icon={<Route className="h-8 w-8" />} title={t("library.learningPaths.empty")} className="py-8" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p) => <LearningPathCard key={p.id} path={p} />)}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
