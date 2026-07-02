import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StudioLayout } from "./StudioLayout";
import * as amsService from "@/services/ai-media-studio/amsService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Mic,
  AudioWaveform,
  Video,
  Star,
  Search,
  ArrowRight,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_TABS = [
  { value: "all", label: "All Templates" },
  { value: "speech", label: "Speech", icon: Mic },
  { value: "voice", label: "Voice Clone", icon: AudioWaveform },
  { value: "video", label: "Video", icon: Video },
];

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-500/10 text-blue-600",
  news: "bg-orange-500/10 text-orange-600",
  creative: "bg-violet-500/10 text-violet-600",
  education: "bg-green-500/10 text-green-600",
  media: "bg-pink-500/10 text-pink-600",
  wellness: "bg-teal-500/10 text-teal-600",
  general: "bg-muted text-muted-foreground",
};

export default function Templates() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["ams", "templates", typeFilter],
    queryFn: () => amsService.listTemplates(typeFilter !== "all" ? typeFilter : undefined),
  });

  const templates = (query.data ?? []).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <StudioLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Jump-start your projects with ready-made configurations
            </p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search templates"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList>
            {TYPE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>


        {/* Template grid */}
        {query.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-dashed rounded-2xl">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No templates found</p>
              <p className="text-sm text-muted-foreground mt-1">Try changing your search or filter</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => {
              const categoryClass = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.general;
              const isComingSoon = false;
              return (
                <div
                  key={t.id}
                  className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 hover:shadow-md transition-all"
                >
                  {isComingSoon && (
                    <Badge variant="secondary" className="absolute top-3 right-3 text-[10px] gap-0.5 px-1.5 py-0">
                      <Lock className="h-2.5 w-2.5" />Soon
                    </Badge>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold capitalize", categoryClass)}>
                      {t.category}
                    </div>
                    {t.usage_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        {t.usage_count.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isComingSoon ? "secondary" : "default"}
                    disabled={isComingSoon}
                    className="mt-auto"
                  >
                    {isComingSoon ? (
                      <>
                        <Lock className="h-3.5 w-3.5 mr-1.5" />
                        Coming Soon
                      </>
                    ) : (
                      <>
                        Use Template
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudioLayout>
  );
}
