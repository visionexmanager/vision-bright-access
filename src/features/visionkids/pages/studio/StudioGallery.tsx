import { useState } from "react";
import { Images } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePublicGallery } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { ProjectGallery } from "@/features/visionkids/components/studio/ProjectGallery";
import type { ProjectType } from "@/features/visionkids/types/studio.types";

const TYPES: ProjectType[] = ["story", "book", "drawing", "character", "comic", "sticker", "music", "voice", "video", "cartoon_scene"];

export default function StudioGallery() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ProjectType | "all">("all");
  const { data: projects = [], isLoading } = usePublicGallery(filter === "all" ? undefined : filter, 60);

  useDocumentHead({ title: t("kids.studio.galleryTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/gallery" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Images className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.studio.galleryTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.studio.gallerySubtitle")}</p>

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
        <ProjectGallery projects={projects} isLoading={isLoading} emptyKey="kids.studio.galleryEmpty" />
      </div>
    </div>
  );
}
