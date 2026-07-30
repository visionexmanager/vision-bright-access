import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp } from "@/features/visionkids/utils/animations";
import type { StoryNode, StoryChoice } from "@/features/visionkids/types/stories.types";

interface InteractiveStoryPlayerProps {
  nodes: StoryNode[];
  choices: StoryChoice[];
  startNodeId?: string;
  onNodeChange?: (nodeId: string) => void;
  onEnding?: (node: StoryNode) => void;
}

export function InteractiveStoryPlayer({ nodes, choices, startNodeId, onNodeChange, onEnding }: InteractiveStoryPlayerProps) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const startNode = nodes.find((n) => n.id === startNodeId) ?? nodes.find((n) => n.is_start) ?? nodes[0];
  const [currentNodeId, setCurrentNodeId] = useState(startNode?.id);
  const [path, setPath] = useState<string[]>(startNode ? [startNode.id] : []);

  const currentNode = nodes.find((n) => n.id === currentNodeId);
  const nodeChoices = useMemo(
    () => choices.filter((c) => c.node_id === currentNodeId).sort((a, b) => a.order_index - b.order_index),
    [choices, currentNodeId]
  );

  if (!currentNode) return null;

  const pick = (choice: StoryChoice) => {
    if (!choice.next_node_id) return;
    setCurrentNodeId(choice.next_node_id);
    setPath((p) => [...p, choice.next_node_id!]);
    onNodeChange?.(choice.next_node_id);
    const nextNode = nodes.find((n) => n.id === choice.next_node_id);
    if (nextNode?.is_ending) onEnding?.(nextNode);
  };

  const restart = () => {
    if (!startNode) return;
    setCurrentNodeId(startNode.id);
    setPath([startNode.id]);
    onNodeChange?.(startNode.id);
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div key={currentNode.id} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)}>
          {currentNode.image_url && (
            <img src={currentNode.image_url} alt="" className="mb-4 aspect-video w-full rounded-xl object-cover" />
          )}
          <p className="text-lg leading-relaxed">{currentNode.text_content}</p>

          {currentNode.is_ending ? (
            <motion.div variants={slideUp(reduced)} className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-kids-accent/10 p-6 text-center">
              <PartyPopper className="h-8 w-8 text-kids-accent" aria-hidden="true" />
              <p className="font-heading text-lg font-bold">{t("kids.interactive.theEnd")}</p>
              <Button onClick={restart} variant="outline" className="gap-1.5">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.interactive.tryAnotherPath")}
              </Button>
            </motion.div>
          ) : (
            <div className="mt-6 flex flex-col gap-2" role="group" aria-label={t("kids.interactive.whatHappensNext")}>
              {nodeChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => pick(choice)}
                  className="rounded-xl border-2 border-border bg-card px-4 py-3 text-start font-medium transition-colors hover:border-kids-primary hover:bg-kids-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {choice.choice_text}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-4 text-xs text-muted-foreground">{t("kids.interactive.stepsTaken")}: {path.length}</p>
    </div>
  );
}
