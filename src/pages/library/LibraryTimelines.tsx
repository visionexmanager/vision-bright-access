import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Plus, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useTimelines } from "@/hooks/library/useTimelines";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryTimelineType } from "@/services/library/timelines";

const TIMELINE_TYPES: LibraryTimelineType[] = ["historical", "scientific_discovery", "book_series", "author_life", "technology_evolution"];

export default function LibraryTimelines() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [filter, setFilter] = useState<LibraryTimelineType | "all">("all");
  const { timelines, isLoading, create } = useTimelines(filter === "all" ? undefined : filter);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<LibraryTimelineType>("historical");

  useDocumentHead({ title: t("library.timelines.title") });

  return (
    <Layout>
      <LibraryLayout
        title={t("library.timelines.title")}
        breadcrumb={[{ label: t("library.timelines.title") }]}
        headerActions={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.timelines.create")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.timelines.create")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="tl-title">{t("library.timelines.titleLabel")}</Label><Input id="tl-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><Label htmlFor="tl-desc">{t("library.timelines.descriptionLabel")}</Label><Textarea id="tl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <div>
                    <Label>{t("library.timelines.typeLabel")}</Label>
                    <Select value={type} onValueChange={(v) => setType(v as LibraryTimelineType)}>
                      <SelectTrigger aria-label={t("library.timelines.typeLabel")}><SelectValue /></SelectTrigger>
                      <SelectContent>{TIMELINE_TYPES.map((tt) => <SelectItem key={tt} value={tt}>{t(`library.timelines.type.${tt}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!title.trim()}
                    onClick={async () => {
                      const created = await create({ title: title.trim(), description: description.trim() || null, timeline_type: type });
                      if (created) { setOpen(false); setTitle(""); setDescription(""); }
                    }}
                  >
                    {t("library.timelines.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      >
        <Tabs value={filter} onValueChange={(v) => setFilter(v as LibraryTimelineType | "all")} className="mb-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">{t("library.highlights.all")}</TabsTrigger>
            {TIMELINE_TYPES.map((tt) => <TabsTrigger key={tt} value={tt}>{t(`library.timelines.type.${tt}`)}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : timelines.length === 0 ? (
          <EmptyState icon={<Clock3 className="h-8 w-8" />} title={t("library.timelines.empty")} className="py-8" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timelines.map((tl) => (
              <Link key={tl.id} to={`/library/timelines/${tl.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock3 className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                      <span className="line-clamp-1">{tl.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tl.description && <p className="line-clamp-2 text-sm text-muted-foreground">{tl.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{t(`library.timelines.type.${tl.timeline_type}`)}</Badge>
                      {tl.is_ai_generated && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" /> {t("library.timelines.aiGenerated")}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
