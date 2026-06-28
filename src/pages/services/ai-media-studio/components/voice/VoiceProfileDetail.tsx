import { useState } from "react";
import {
  ArrowLeft, Pencil, Star, CheckCircle2, Mic2,
  Clock, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DatasetUploader } from "./DatasetUploader";
import { TrainingPipeline } from "./TrainingPipeline";
import { QualityAnalysis } from "./QualityAnalysis";
import { useVoiceDatasets } from "@/hooks/useVoiceDatasets";
import { useVoiceTraining } from "@/hooks/useVoiceTraining";
import { useVoiceProfiles } from "@/hooks/useVoiceProfiles";
import { DATASET_CONSTRAINTS } from "@/lib/types/voice-studio";
import { cn } from "@/lib/utils";
import type { VoiceProfile } from "@/lib/types/voice-studio";

interface Props {
  profile: VoiceProfile;
  onBack:  () => void;
}

export function VoiceProfileDetail({ profile, onBack }: Props) {
  const { updateProfile, toggleFavorite } = useVoiceProfiles();
  const { datasets, uploads, uploadFiles, cancelUpload, retryUpload, clearCompleted, deleteDataset } =
    useVoiceDatasets(profile.id);
  const { job, logs, isActive, startTraining, cancelTraining, isStarting, isCancelling } =
    useVoiceTraining(profile.id);

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState(profile.name);

  const isTraining  = profile.status === "training";
  const isCompleted = profile.status === "completed";

  const canStartTraining =
    profile.status === "draft" &&
    profile.total_duration_sec >= DATASET_CONSTRAINTS.MIN_TOTAL_SEC &&
    datasets.filter((d) => d.status === "accepted").length > 0;

  const saveName = () => {
    if (nameVal.trim() && nameVal.trim() !== profile.name) {
      updateProfile({ id: profile.id, input: { name: nameVal.trim() } });
    }
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {editingName ? (
          <Input
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="h-8 text-base font-semibold max-w-xs"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-bold truncate">{profile.name}</h1>
            <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Status badge */}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] capitalize",
            isCompleted ? "text-green-600 border-green-500/30 bg-green-500/10" :
            isTraining  ? "text-blue-600 border-blue-500/30 bg-blue-500/10"   :
                          "bg-muted text-muted-foreground"
          )}
        >
          {isTraining ? "Training…" : profile.status}
        </Badge>

        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleFavorite({ id: profile.id, current: profile.is_favorite })}
          >
            <Star className={cn("h-4 w-4", profile.is_favorite && "fill-amber-400 text-amber-400")} />
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-6 px-6 py-3 border-b text-xs text-muted-foreground bg-muted/30 shrink-0">
        <span className="flex items-center gap-1.5">
          <Mic2 className="h-3.5 w-3.5" />
          {profile.sample_count} sample{profile.sample_count !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {Math.round(profile.total_duration_sec)}s total
        </span>
        {profile.quality_score != null && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Quality {profile.quality_score.toFixed(1)}/10
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          {profile.provider ?? "ElevenLabs"}
        </span>
        {isCompleted && profile.provider_voice_id && (
          <span className="text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Available in Speech Studio
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="samples" className="h-full">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="samples" className="text-xs">Audio Samples</TabsTrigger>
              <TabsTrigger value="training" className="text-xs">Training</TabsTrigger>
              <TabsTrigger value="quality" className="text-xs">Quality</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="samples" className="px-6 py-4 mt-0">
            <DatasetUploader
              datasets={datasets}
              uploads={uploads}
              totalRequired={DATASET_CONSTRAINTS.RECOMMENDED_SEC}
              totalCurrent={profile.total_duration_sec}
              onUpload={uploadFiles}
              onCancel={cancelUpload}
              onRetry={retryUpload}
              onDelete={(id, storagePath) => deleteDataset({ id, storagePath })}
              onClearDone={clearCompleted}
              disabled={isTraining}
            />
          </TabsContent>

          <TabsContent value="training" className="px-6 py-4 mt-0">
            <TrainingPipeline
              profile={profile}
              job={job}
              logs={logs}
              isActive={isActive}
              canStart={canStartTraining}
              isStarting={isStarting}
              isCancelling={isCancelling}
              onStart={startTraining}
              onCancel={() => job && cancelTraining(job.id)}
            />
          </TabsContent>

          <TabsContent value="quality" className="px-6 py-4 mt-0">
            <QualityAnalysis datasets={datasets} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
