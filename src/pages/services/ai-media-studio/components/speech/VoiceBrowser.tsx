import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Clock, Sparkles, X, Mic2 } from "lucide-react";
import { VoiceCard } from "./VoiceCard";
import { useSpeechVoices } from "@/hooks/useSpeechVoices";
import { cn } from "@/lib/utils";
import type { SpeechVoice, VoiceCategory } from "@/lib/types/speech-studio";

const CATEGORIES: { value: VoiceCategory | "all"; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "general",   label: "General" },
  { value: "education", label: "Education" },
  { value: "creative",  label: "Creative" },
  { value: "news",      label: "News" },
  { value: "media",     label: "Media" },
  { value: "tech",      label: "Tech" },
  { value: "wellness",  label: "Wellness" },
  { value: "assistant", label: "Assistant" },
];

const GENDER_TABS = [
  { value: "all",    label: "All" },
  { value: "male",   label: "Male" },
  { value: "female", label: "Female" },
  { value: "neutral",label: "Neutral" },
];

type BrowserTab = "all" | "favorites" | "recent" | "recommended" | "my-voices";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedVoiceId?: string;
  onSelect: (voice: SpeechVoice) => void;
}

export function VoiceBrowser({ open, onOpenChange, selectedVoiceId, onSelect }: Props) {
  const {
    voices, allVoices, recentVoices, favoriteVoices, recommendedVoices,
    isLoading, filters, updateFilters, toggleFavorite, favoriteIds,
  } = useSpeechVoices();

  const [tab, setTab]             = useState<BrowserTab>("all");
  const [genderFilter, setGender] = useState<string>("all");
  const [catFilter, setCat]       = useState<string>("all");

  // Apply gender + category on top of the hook's filters
  // "My Voices" = user-cloned voices (id starts with "user-")
  const myVoices = useMemo(
    () => allVoices.filter((v) => v.id.startsWith("user-")),
    [allVoices]
  );

  const displayVoices: SpeechVoice[] = useMemo(() => {
    let list: SpeechVoice[];
    switch (tab) {
      case "favorites":  list = favoriteVoices;    break;
      case "recent":     list = recentVoices;      break;
      case "recommended":list = recommendedVoices; break;
      case "my-voices":  list = myVoices;          break;
      default:           list = voices;            break;
    }
    if (genderFilter !== "all") list = list.filter((v) => v.gender === genderFilter);
    if (catFilter !== "all")    list = list.filter((v) => v.category === catFilter);
    return list;
  }, [tab, voices, favoriteVoices, recentVoices, recommendedVoices, myVoices, genderFilter, catFilter]);

  const handleSelect = (voice: SpeechVoice) => {
    onSelect(voice);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Voice Library
          </SheetTitle>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search voices by name, accent, or style…"
              value={filters.query ?? ""}
              onChange={(e) => updateFilters({ query: e.target.value || undefined })}
              aria-label="Search voices"
            />
            {filters.query && (
              <button
                onClick={() => updateFilters({ query: undefined })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b shrink-0 space-y-3">
          {/* Tab row */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as BrowserTab)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-7">
                All ({allVoices.length})
              </TabsTrigger>
              <TabsTrigger value="recommended" className="text-xs px-3 h-7 gap-1">
                <Sparkles className="h-3 w-3" />Recommended
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs px-3 h-7 gap-1">
                <Star className="h-3 w-3" />Favorites ({favoriteVoices.length})
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs px-3 h-7 gap-1">
                <Clock className="h-3 w-3" />Recent ({recentVoices.length})
              </TabsTrigger>
              {myVoices.length > 0 && (
                <TabsTrigger value="my-voices" className="text-xs px-3 h-7 gap-1">
                  <Mic2 className="h-3 w-3" />My Voices ({myVoices.length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {/* Gender filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {GENDER_TABS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGender(g.value)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  genderFilter === g.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                {g.label}
              </button>
            ))}
            <span className="text-border ml-1">|</span>
            <div className="flex items-center gap-1 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCat(c.value)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    catFilter === c.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "border-border hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : displayVoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Search className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No voices found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tab === "favorites"  ? "Save some voices to see them here" :
                   tab === "recent"     ? "Generate some audio to build your recent history" :
                   tab === "my-voices"  ? "Train a voice profile in Voice Studio to see it here" :
                   "Try different search terms or filters"}
                </p>
              </div>
              {(filters.query || genderFilter !== "all" || catFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { updateFilters({ query: undefined }); setGender("all"); setCat("all"); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {displayVoices.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={voice.id === selectedVoiceId}
                  onSelect={handleSelect}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {displayVoices.length} voice{displayVoices.length !== 1 ? "s" : ""} · Powered by OpenAI TTS
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
