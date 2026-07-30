import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGroups, useCreateGroup } from "@/features/visionkids/hooks/social/useGroups";
import { GroupCard } from "@/features/visionkids/components/social/GroupCard";
import type { SocialGroupType } from "@/features/visionkids/types/social.types";

const CREATIVE_TYPES: { value: SocialGroupType; labelKey: string; emoji: string }[] = [
  { value: "creative_drawing", labelKey: "kids.social.clubs.creativeDrawing", emoji: "🎨" },
  { value: "creative_stories", labelKey: "kids.social.clubs.creativeStories", emoji: "✍️" },
  { value: "creative_music", labelKey: "kids.social.clubs.creativeMusic", emoji: "🎵" },
  { value: "creative_coding", labelKey: "kids.social.clubs.creativeCoding", emoji: "💻" },
  { value: "creative_robotics", labelKey: "kids.social.clubs.creativeRobotics", emoji: "🤖" },
];

interface ClubListConfig {
  groupType: SocialGroupType | SocialGroupType[];
  titleKey: string;
  subtitleKey: string;
  emoji: string;
  hasSubTabs?: boolean;
}

const CONFIGS: Record<string, ClubListConfig> = {
  study: { groupType: "study", titleKey: "kids.social.nav.studyGroups", subtitleKey: "kids.social.clubs.studySubtitle", emoji: "📚" },
  reading: { groupType: "reading", titleKey: "kids.social.nav.readingClubs", subtitleKey: "kids.social.clubs.readingSubtitle", emoji: "📖" },
  creative: { groupType: CREATIVE_TYPES.map((c) => c.value), titleKey: "kids.social.nav.creativeClubs", subtitleKey: "kids.social.clubs.creativeSubtitle", emoji: "🎨", hasSubTabs: true },
};

/** Generic club-list page shared by Study Groups, Reading Clubs, and every
 *  Creative Club sub-type — driven by the :category URL param via CONFIGS
 *  above, same "one page + a config lookup" discipline as Explorer's
 *  WorldListPage (Phase 6). */
export default function ClubListPage() {
  const { category } = useParams<{ category: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const config = category ? CONFIGS[category] : undefined;

  const [subType, setSubType] = useState<string>("all");
  const activeGroupType = config?.hasSubTabs && subType !== "all" ? (subType as SocialGroupType) : config?.groupType;

  const { data: groups = [], isLoading } = useGroups(activeGroupType);
  const createGroup = useCreateGroup();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createType, setCreateType] = useState<SocialGroupType>(CREATIVE_TYPES[0].value);

  useDocumentHead({
    title: config ? `${t(config.titleKey)} — VisionKids` : t("kids.social.meta.title"),
    description: t("kids.social.meta.description"),
    canonicalPath: `/kids/social/clubs/${category}`,
  });

  if (!config) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.social.clubs.notFound")}</p>
        <Link to="/kids/social" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  const handleCreate = () => {
    if (!name.trim()) return;
    const groupType = config.hasSubTabs ? createType : (config.groupType as SocialGroupType);
    createGroup.mutate({ groupType, name: name.trim(), description: description.trim() || undefined }, {
      onSuccess: () => { setCreateOpen(false); setName(""); setDescription(""); },
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/kids/social" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.social.heroTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <span aria-hidden="true">{config.emoji}</span> {t(config.titleKey)}
        </h1>
        {user && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.social.clubs.create")}</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("kids.social.clubs.create")}</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                {config.hasSubTabs && (
                  <Select value={createType} onValueChange={(v) => setCreateType(v as SocialGroupType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CREATIVE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {t(c.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("kids.social.clubs.namePlaceholder")} maxLength={60} />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("kids.social.clubs.descriptionPlaceholder")} rows={3} maxLength={300} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("kids.social.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createGroup.isPending || !name.trim()}>{t("kids.social.clubs.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">{t(config.subtitleKey)}</p>

      {config.hasSubTabs && (
        <Tabs value={subType} onValueChange={setSubType} className="mt-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="all" className="rounded-full border-2 border-border data-[state=active]:border-kids-primary data-[state=active]:bg-kids-primary/10">{t("kids.explorer.categoryAll")}</TabsTrigger>
            {CREATIVE_TYPES.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="rounded-full border-2 border-border data-[state=active]:border-kids-primary data-[state=active]:bg-kids-primary/10">
                {c.emoji} {t(c.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.social.clubs.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}
    </div>
  );
}
