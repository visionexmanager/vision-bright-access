import { useState } from "react";
import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyProjects } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { ProjectGallery } from "@/features/visionkids/components/studio/ProjectGallery";
import type { ProjectType } from "@/features/visionkids/types/studio.types";

const TYPES: ProjectType[] = ["story", "book", "drawing", "character", "comic", "sticker", "music", "voice", "video", "cartoon_scene"];

export default function MyProjects() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [filter, setFilter] = useState<ProjectType | "all">("all");
  const { data: projects = [], isLoading } = useMyProjects(filter === "all" ? undefined : filter);

  useDocumentHead({ title: t("kids.studio.myProjectsTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/my-projects" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Folder className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Folder className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.studio.myProjectsTitle")}
      </h1>

      <div className="mt-4">
        <Select value={filter} onValueChange={(v) => setFilter(v as ProjectType | "all")}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kids.stories.allAges")}</SelectItem>
            {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t(`kids.studio.type.${ty}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        <ProjectGallery projects={projects} isLoading={isLoading} />
      </div>
    </div>
  );
}
