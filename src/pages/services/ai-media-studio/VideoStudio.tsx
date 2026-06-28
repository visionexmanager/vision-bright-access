import { useState } from "react";
import { StudioLayout } from "./StudioLayout";
import { VideoGeneratorPanel } from "./components/video/VideoGeneratorPanel";
import { VideoLibrary } from "./components/video/VideoLibrary";
import { useVideoGenerate } from "@/hooks/useVideoGenerate";
import type { VideoGenerateForm } from "@/lib/types/video-studio";
import { DEFAULT_FORM } from "@/lib/types/video-studio";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Wand2 } from "lucide-react";

export default function VideoStudio() {
  const [form, setForm]         = useState<VideoGenerateForm>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState<"generate" | "library">("generate");
  const { state: genState, generate, reset } = useVideoGenerate();

  const handleGenerate = () => {
    generate(form);
    // Optionally switch to library to see the new job
    // setActiveTab("library");
  };

  return (
    <StudioLayout>
      {/* Mobile: tab switcher */}
      <div className="flex h-full flex-col lg:hidden">
        <div className="border-b border-border px-4 pt-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "library")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate" className="gap-1.5">
                <Wand2 className="size-3.5" /> Generate
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-1.5">
                <Film className="size-3.5" /> Library
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className={cn("flex-1 overflow-hidden", activeTab !== "generate" && "hidden")}>
          <VideoGeneratorPanel
            form={form}
            setForm={setForm}
            onGenerate={handleGenerate}
            genState={genState}
            onReset={reset}
          />
        </div>
        <div className={cn("flex-1 overflow-hidden", activeTab !== "library" && "hidden")}>
          <VideoLibrary />
        </div>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden h-full lg:flex overflow-hidden">
        {/* Left: generator */}
        <div className="w-80 xl:w-96 shrink-0 border-r border-border overflow-hidden">
          <VideoGeneratorPanel
            form={form}
            setForm={setForm}
            onGenerate={handleGenerate}
            genState={genState}
            onReset={reset}
          />
        </div>
        {/* Right: library */}
        <div className="flex-1 overflow-hidden">
          <VideoLibrary />
        </div>
      </div>
    </StudioLayout>
  );
}
