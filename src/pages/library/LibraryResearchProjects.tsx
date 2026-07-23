import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Users } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { useResearchProjects } from "@/hooks/library/useResearchProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryResearchProjects() {
  const { t } = useLanguage();
  const { projects, isLoading, create } = useResearchProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useDocumentHead({ title: t("library.researchProjects.title") });

  const handleCreate = async () => {
    if (!title.trim()) return;
    const project = await create(title.trim(), description.trim() || undefined);
    if (project) {
      setIsOpen(false);
      setTitle("");
      setDescription("");
    }
  };

  return (
    <Layout>
      <LibraryLayout
        title={t("library.researchProjects.title")}
        breadcrumb={[{ label: t("library.researchProjects.title") }]}
        headerActions={
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.researchProjects.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.researchProjects.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="rp-title">{t("library.researchProjects.titleLabel")}</Label>
                  <Input id="rp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="rp-desc">{t("library.researchProjects.descriptionLabel")}</Label>
                  <Textarea id="rp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void handleCreate()} disabled={!title.trim()}>{t("library.researchProjects.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {!isLoading && projects.length === 0 ? (
          <EmptyState icon={<FolderKanban className="h-8 w-8" />} title={t("library.researchProjects.empty")} className="py-12" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/library/research-projects/${project.id}`}>
                <Card className="flex h-full flex-col gap-2 p-4 hover:shadow-md">
                  <h2 className="line-clamp-1 font-semibold">{project.title}</h2>
                  {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
                  {project.is_shared && (
                    <span className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.shared")}
                    </span>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
